import Schema from "@deepseek-ai/schemastery";
import { ProxyAgent, fetch as fetch$1 } from "undici";
import { connect } from "node:net";
let current = {
	visionBaseURL: "",
	visionModel: "glm-4.6v-flash",
	maxCandidates: 6,
	sourcesWikimedia: true,
	sourcesOpenverse: true,
	sourcesBingCn: true
};
function setRuntimeSettings(partial) {
	current = {
		...current,
		...partial
	};
}
function getRuntimeSettings() {
	return current;
}
/** env 优先，settings 次之，默认兜底。 */
function pickEnvThenSettings(env, envName, setting, fallback) {
	const fromEnv = env[envName];
	if (fromEnv !== void 0 && fromEnv.length > 0) return fromEnv;
	if (setting.length > 0) return setting;
	return fallback;
}
//#endregion
//#region src/plugin/net.ts
/**
* Proxy-aware fetch for the node half.
*
* Node's global fetch ignores HTTP(S)_PROXY. Honors DSH_GALLERY_HTTPS_PROXY,
* then HTTPS_PROXY / https_proxy / HTTP_PROXY / http_proxy; additionally
* AUTO-DISCOVERS a listening local proxy (common candidate ports, extendable
* via DSH_GALLERY_PROXY_PORTS) so the plugin works install-and-use without
* env configuration. Loopback targets always bypass the proxy.
*
* Proxy requests use undici's ProxyAgent (standard, battle-tested CONNECT
* tunnel). undici is a runtime dependency resolved from the plugin's own
* node_modules (kept external in the tsdown lib build).
*/
function proxyUrlOf(env = process.env) {
	return env.DSH_GALLERY_HTTPS_PROXY ?? env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy ?? void 0;
}
let cachedAgent;
let cachedAgentUrl;
function agentFor(proxyUrl) {
	if (cachedAgent !== void 0 && cachedAgentUrl === proxyUrl) return cachedAgent;
	cachedAgent = new ProxyAgent(proxyUrl);
	cachedAgentUrl = proxyUrl;
	return cachedAgent;
}
/** 自动发现候选：常见本地代理端口（可经 DSH_GALLERY_PROXY_PORTS 逗号分隔追加）。 */
const DEFAULT_AUTO_PROXY_PORTS = [
	7890,
	7897,
	10809
];
function autoProxyCandidates(env = process.env) {
	const extra = (env.DSH_GALLERY_PROXY_PORTS ?? "").split(",").map((entry) => Number(entry.trim())).filter((n) => Number.isInteger(n) && n > 0 && n < 65536);
	return [.../* @__PURE__ */ new Set([...DEFAULT_AUTO_PROXY_PORTS, ...extra])];
}
function tcpProbe(port) {
	return new Promise((resolve) => {
		const socket = connect({
			host: "127.0.0.1",
			port
		});
		let settled = false;
		const done = (ok) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			resolve(ok);
		};
		socket.setTimeout(800);
		socket.once("connect", () => done(true));
		socket.once("timeout", () => done(false));
		socket.once("error", () => done(false));
	});
}
let discovered;
/**
* 安装即用：未显式配置代理时，探测常见本地代理端口并自动使用。
* 每进程只探测一次；端口在听才启用。用户显式配置的代理始终优先。
*/
async function discoverLocalProxy() {
	if (discovered !== void 0) return discovered ?? void 0;
	for (const port of autoProxyCandidates()) if (await tcpProbe(port)) {
		discovered = `http://127.0.0.1:${port}`;
		return discovered;
	}
	discovered = null;
}
async function proxiedFetch(input, init = {}) {
	const url = new URL(input);
	const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
	const explicit = proxyUrlOf();
	const proxy = isLoopback ? void 0 : explicit ?? await discoverLocalProxy();
	if (proxy !== void 0) return await fetch$1(input, {
		dispatcher: agentFor(proxy),
		method: init.method,
		headers: init.headers,
		body: init.body,
		signal: init.signal
	});
	return fetch(input, {
		method: init.method,
		headers: init.headers,
		body: init.body,
		signal: init.signal
	});
}
//#endregion
//#region src/plugin/vision.ts
const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const DEFAULT_MODEL = "glm-4.6v-flash";
function resolveVisionConfig(env = process.env) {
	const key = env.DSH_GALLERY_VISION_KEY ?? "";
	if (key.length === 0) return null;
	return {
		baseURL: (env.DSH_GALLERY_VISION_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
		key,
		model: env.DSH_GALLERY_VISION_MODEL ?? DEFAULT_MODEL
	};
}
let keyResolver;
/** 宿主注入凭据解析器（credentials 服务）；env 无 key 时回退到这里。 */
function setVisionKeyResolver(resolver) {
	keyResolver = resolver;
}
/** 解析优先级：env → settings（设置页）→ credentials 服务 → 未配置。 */
async function getVisionConfig() {
	const settings = getRuntimeSettings();
	const fromEnv = resolveVisionConfig();
	if (fromEnv !== null) return fromEnv;
	const baseURL = pickEnvThenSettings(process.env, "DSH_GALLERY_VISION_BASE_URL", settings.visionBaseURL, DEFAULT_BASE_URL);
	const model = pickEnvThenSettings(process.env, "DSH_GALLERY_VISION_MODEL", settings.visionModel, DEFAULT_MODEL);
	if (keyResolver === void 0) return null;
	const key = await keyResolver();
	if (key === void 0 || key.length === 0) return null;
	return {
		baseURL: baseURL.replace(/\/+$/, ""),
		key,
		model
	};
}
async function chat(config, messages, maxTokens, signal) {
	const res = await proxiedFetch(`${config.baseURL}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.key}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			model: config.model,
			messages,
			max_tokens: maxTokens,
			temperature: .2
		}),
		signal
	});
	const body = await res.json();
	if (!res.ok) throw new Error(`vision api ${res.status}: ${body.error?.message ?? "unknown error"}`);
	const text = body.choices?.[0]?.message?.content ?? "";
	if (text.length === 0) throw new Error("vision api returned empty content");
	return text;
}
/** Strip ```json fences the model may wrap around the JSON answer. */
function stripJsonFences(text) {
	const trimmed = text.trim();
	const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
	if (fence?.[1] !== void 0) return fence[1];
	const first = trimmed.indexOf("[");
	const last = trimmed.lastIndexOf("]");
	if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
	return trimmed;
}
const CURATE_PROMPT = (topic, count) => `你是图片筛选助手。用户主题：「${topic}」。下面按顺序给出 ${count} 张图片。对每张图片判断：1) relevant：是否与主题相关；2) safety：是否包含令人不适/恐怖/血腥内容（是则 safety=false）；3) caption：一句中文说明（10 字左右）。只输出 JSON 数组，不要任何其他文字，格式：[{"index":0,"relevant":true,"safety":true,"caption":"..."},...]，index 按图片出现顺序 0..${count - 1}。`;
const MAX_IMAGE_BYTES = 4194304;
/**
* 把候选图下载为 base64 data URL（走代理感知 fetch）。
* 实测坑（2026-08-16）：智谱服务器侧拉取 Wikimedia 等海外图源会超时（1210），
* 因此由插件本地取图后直传 base64，绕开供应商侧取图；也顺带约束图片体积。
*/
async function imageToDataUrl(url) {
	try {
		const res = await proxiedFetch(url, { signal: AbortSignal.timeout(15e3) });
		if (!res.ok) return null;
		const buffer = new Uint8Array(await res.arrayBuffer());
		if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;
		return `data:${res.headers.get("content-type") ?? "image/jpeg"};base64,${Buffer.from(buffer).toString("base64")}`;
	} catch {
		return null;
	}
}
/**
* Curate up to 8 candidate images in one call. Images are downloaded locally
* and sent as base64 data URLs. Failures map to a structured error object
* instead of throwing out of the tool.
*/
async function curateImages(items, topic) {
	const config = await getVisionConfig();
	if (config === null) return { error: "vision_unconfigured" };
	const list = items.slice(0, 8);
	if (list.length === 0) return { results: [] };
	const analyzed = [];
	await Promise.all(list.map(async (item) => {
		const dataUrl = await imageToDataUrl(item.url);
		if (dataUrl !== null) analyzed.push({
			originalIndex: item.index ?? analyzed.length,
			dataUrl
		});
	}));
	if (analyzed.length === 0) return { results: [] };
	const messages = [{
		role: "user",
		content: [{
			type: "text",
			text: CURATE_PROMPT(topic, analyzed.length)
		}, ...analyzed.map((entry) => ({
			type: "image_url",
			image_url: { url: entry.dataUrl }
		}))]
	}];
	const attempt = async () => {
		const signal = AbortSignal.timeout(45e3);
		const text = await chat(config, messages, 1200, signal);
		const parsed = JSON.parse(stripJsonFences(text));
		if (!Array.isArray(parsed)) throw new Error("curate response is not an array");
		return parsed.map((entry, i) => ({
			index: analyzed[i]?.originalIndex ?? (typeof entry.index === "number" ? entry.index : i),
			relevant: entry.relevant !== false,
			safety: entry.safety !== false,
			caption: typeof entry.caption === "string" ? entry.caption.slice(0, 80) : ""
		}));
	};
	try {
		return { results: await attempt() };
	} catch (first) {
		try {
			return { results: await attempt() };
		} catch (second) {
			return { error: `vision_curate_failed: ${second instanceof Error ? second.message.slice(0, 200) : "unknown"}` };
		}
	}
}
//#endregion
//#region src/plugin/sources.ts
const USER_AGENT = "dsh-gallery/0.0.1 (DeepSeek Harness plugin; local usage)";
const BING_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
/** 图源主机可经环境变量覆盖（镜像/内网/测试注入）；默认官方端点。 */
function wikimediaBase(env = process.env) {
	return env.DSH_GALLERY_WIKIMEDIA_URL ?? "https://commons.wikimedia.org/w/api.php";
}
function openverseBase(env = process.env) {
	return env.DSH_GALLERY_OPENVERSE_URL ?? "https://api.openverse.org/v1/images/";
}
function bingcnBase(env = process.env) {
	return env.DSH_GALLERY_BINGCN_URL ?? "https://cn.bing.com/images/async";
}
function stripHtml(value) {
	if (typeof value !== "string") return "";
	return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}
/** Pure mapper（可测试）：Wikimedia API 页面 → 候选；无可用图返回 null。 */
function wikimediaPageToCandidate(page) {
	const info = page.imageinfo?.[0];
	if (info?.url === void 0) return null;
	const displayUrl = info.thumburl ?? info.url;
	return {
		url: displayUrl,
		thumb: displayUrl,
		title: (page.title ?? "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").slice(0, 120),
		desc: stripHtml(info.extmetadata?.ImageDescription?.value),
		source: "Wikimedia Commons",
		sourceUrl: info.descriptionurl ?? info.url
	};
}
async function searchWikimedia(query, n) {
	const params = new URLSearchParams({
		action: "query",
		generator: "search",
		gsrsearch: `filetype:bitmap ${query}`,
		gsrnamespace: "6",
		gsrlimit: String(n),
		prop: "imageinfo",
		iiprop: "url|extmetadata",
		iiurlwidth: "480",
		format: "json",
		origin: "*"
	});
	const res = await proxiedFetch(`${wikimediaBase()}?${params.toString()}`, {
		headers: { "User-Agent": USER_AGENT },
		signal: AbortSignal.timeout(2e4)
	});
	if (!res.ok) throw new Error(`wikimedia ${res.status}`);
	const pages = (await res.json()).query?.pages ?? {};
	const out = [];
	for (const page of Object.values(pages)) {
		const candidate = wikimediaPageToCandidate(page);
		if (candidate !== null) out.push(candidate);
	}
	return out;
}
async function searchOpenverse(query, n) {
	const res = await proxiedFetch(`${openverseBase()}?q=${encodeURIComponent(query)}&page_size=${n}`, {
		headers: { "User-Agent": USER_AGENT },
		signal: AbortSignal.timeout(2e4)
	});
	if (!res.ok) throw new Error(`openverse ${res.status}`);
	const data = await res.json();
	const out = [];
	for (const r of data.results ?? []) {
		if (r.url === void 0) continue;
		out.push({
			url: r.url,
			thumb: r.thumbnail ?? r.url,
			title: (r.title ?? "").slice(0, 120),
			desc: r.creator ? `by ${r.creator}`.slice(0, 160) : "",
			source: "Openverse",
			sourceUrl: r.foreign_landing_url ?? r.url
		});
	}
	return out;
}
/** 解析 cn.bing.com/images/async 的 HTML：`m="..."` 属性（HTML 实体编码的 JSON）。 */
function parseBingAsyncHtml(html) {
	const out = [];
	const re = /m="([^"]+)"/g;
	let match;
	while ((match = re.exec(html)) !== null) {
		const raw = match[1].replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
		try {
			const obj = JSON.parse(raw);
			if (typeof obj.murl === "string" && obj.murl.length > 0) out.push({
				murl: obj.murl,
				turl: obj.turl,
				purl: obj.purl
			});
		} catch {}
	}
	return out;
}
/** 国内直连可达、免 key 的兜底图源：cn.bing.com 图片搜索（网页接口抓取）。
* adlt=strict 启用必应严格安全搜索——无视觉模型时的零配置安全兜底。 */
async function searchBingCn(query, n) {
	const res = await proxiedFetch(`${bingcnBase()}?q=${encodeURIComponent(query)}&first=0&count=${n}&mmasync=1&adlt=strict`, {
		headers: { "User-Agent": BING_UA },
		signal: AbortSignal.timeout(15e3)
	});
	if (!res.ok) throw new Error(`bingcn ${res.status}`);
	return parseBingAsyncHtml(await res.text()).slice(0, n).map((entry, i) => {
		const display = entry.turl ?? entry.murl ?? "";
		return {
			url: display,
			thumb: display,
			title: `必应图片 ${i + 1}`,
			desc: "",
			source: "Bing 图片",
			sourceUrl: entry.purl ?? entry.murl ?? ""
		};
	}).filter((candidate) => candidate.url.startsWith("https://"));
}
/** 单次重试：本机实测 wikimedia 直连偶发瞬时失败（fetch failed）。 */
async function withRetry(fn) {
	try {
		return await fn();
	} catch (first) {
		try {
			return await fn();
		} catch (second) {
			throw second;
		}
	}
}
async function searchImages(query, n, source) {
	const settings = getRuntimeSettings();
	const wikimediaEnabled = settings.sourcesWikimedia;
	const openverseEnabled = settings.sourcesOpenverse;
	const bingEnabled = settings.sourcesBingCn;
	if (!wikimediaEnabled && !openverseEnabled && !bingEnabled) return [];
	if (source === "wikimedia") return wikimediaEnabled ? withRetry(() => searchWikimedia(query, n)) : [];
	if (source === "openverse") return openverseEnabled ? withRetry(() => searchOpenverse(query, n)) : [];
	if (source === "bingcn") return bingEnabled ? withRetry(() => searchBingCn(query, n)) : [];
	if (wikimediaEnabled) try {
		const fromWikimedia = await withRetry(() => searchWikimedia(query, n));
		if (fromWikimedia.length > 0) return fromWikimedia;
	} catch {}
	if (openverseEnabled) try {
		const fromOpenverse = await withRetry(() => searchOpenverse(query, n));
		if (fromOpenverse.length > 0) return fromOpenverse;
	} catch {}
	return bingEnabled ? withRetry(() => searchBingCn(query, n)) : [];
}
//#endregion
//#region src/plugin/tools.ts
/**
* Tool definitions for the node half. Plain objects matching the harness
* ToolDefinition shape (output.schema + output.render + execute) — authored
* with local types only so the bundle has zero harness runtime imports.
*/
const textRender = (_args, value) => [{
	type: "text",
	text: typeof value === "string" ? value : JSON.stringify(value)
}];
const IMAGE_SEARCH_SCHEMA = {
	type: "object",
	properties: {
		query: {
			type: "string",
			description: "搜索词（中文或英文）"
		},
		n: {
			type: "number",
			description: "返回候选数量 1-12，默认 6"
		},
		source: {
			type: "string",
			enum: [
				"auto",
				"wikimedia",
				"openverse",
				"bingcn"
			],
			description: "图源：auto（默认，Wikimedia 优先、Openverse 次之、国内必应兜底）/wikimedia/openverse/bingcn，均免 key"
		}
	},
	required: ["query"],
	additionalProperties: false
};
function createImageSearchTool() {
	return {
		name: "image_search",
		description: "搜索图库图片（Wikimedia Commons / Openverse，CC 授权免 key；海外图源不可达时自动回退国内必应图搜，同样免 key）。返回候选的 url、标题、描述、来源与来源页。用于用户要参考图/素材/概念配图时先取候选。候选必须经 vision_curate 筛选（或明示未筛选）后才能放入 dsh-gallery 围栏展示。",
		parameters: IMAGE_SEARCH_SCHEMA,
		output: {
			schema: { type: "string" },
			render: textRender
		},
		isConcurrencySafe: () => true,
		timeoutMs: 6e4,
		async execute(args) {
			const record = args ?? {};
			const query = String(record.query ?? "").trim();
			if (query.length === 0) return JSON.stringify({ error: "empty_query" });
			const n = Math.min(12, Math.max(1, Number(record.n) || getRuntimeSettings().maxCandidates));
			const source = String(record.source ?? "auto");
			try {
				const candidates = await searchImages(query, n, source);
				const visionConfigured = await getVisionConfig() !== null;
				return JSON.stringify({
					query,
					source,
					filteredByVision: visionConfigured,
					candidates
				});
			} catch (error) {
				return JSON.stringify({
					query,
					error: `image_search_failed: ${error instanceof Error ? error.message.slice(0, 200) : "unknown"}`
				});
			}
		}
	};
}
const VISION_CURATE_SCHEMA = {
	type: "object",
	properties: {
		images: {
			type: "array",
			items: {
				type: "object",
				properties: {
					url: { type: "string" },
					index: { type: "number" }
				},
				required: ["url"],
				additionalProperties: false
			},
			description: "候选图片 url 列表，一次最多 8 张"
		},
		topic: {
			type: "string",
			description: "用户要找的主题，用于判断相关性"
		}
	},
	required: ["images", "topic"],
	additionalProperties: false
};
function createVisionCurateTool() {
	return {
		name: "vision_curate",
		description: "用配置的视觉模型筛选候选图片：返回每张的 relevant（是否与主题相关）、safety（是否含不适内容）与 caption（一句话中文说明）。只把 relevant=true 且 safety=true 的图放进 dsh-gallery 围栏展示；视觉模型未配置时返回 vision_unconfigured，此时可展示但必须明示\"未筛选\"。",
		parameters: VISION_CURATE_SCHEMA,
		output: {
			schema: { type: "string" },
			render: textRender
		},
		isConcurrencySafe: () => true,
		timeoutMs: 12e4,
		async execute(args) {
			const record = args ?? {};
			const images = Array.isArray(record.images) ? record.images.filter((item) => typeof item?.url === "string" && item.url.startsWith("https://")).map((item, i) => ({
				url: item.url,
				index: typeof item.index === "number" ? item.index : i
			})) : [];
			const topic = String(record.topic ?? "").trim().slice(0, 200);
			if (topic.length === 0) return JSON.stringify({ error: "empty_topic" });
			if (images.length === 0) return JSON.stringify({ error: "no_valid_images" });
			const result = await curateImages(images, topic);
			return JSON.stringify(result);
		}
	};
}
//#endregion
//#region src/plugin/index.ts
/**
* dsh-gallery node half: teaches the model the ```dsh-gallery fence, and
* registers image_search / vision_curate when the tools service binds.
* Zero runtime harness imports (local contracts only, see context.ts).
*/
/** Convention: tool guidance uses 100-199; genui's fence section is 105. */
const GALLERY_SECTION_ORDER = 106;
/** 视觉模型 Key 在 credentials 服务中的引用名（与 env 同名）。 */
const CREDENTIAL_REF = "DSH_GALLERY_VISION_KEY";
/** 设置页命名空间（settings.yaml 的 dsh-gallery 段）。 */
const SETTINGS_NAMESPACE = "dsh-gallery";
/** 插件配置 schema：也是 settings 命名空间的 schema（bind 用 Config 注册）。 */
const Config = Schema.object({
	visionBaseURL: Schema.string().default("").description("OpenAI 兼容视觉端点；留空用默认 open.bigmodel.cn"),
	visionModel: Schema.string().default("glm-4.6v-flash").description("视觉模型名"),
	maxCandidates: Schema.natural().min(1).max(12).default(6).description("image_search 默认候选数"),
	sourcesWikimedia: Schema.boolean().default(true).description("启用 Wikimedia Commons 图源"),
	sourcesOpenverse: Schema.boolean().default(true).description("启用 Openverse 图源"),
	sourcesBingCn: Schema.boolean().default(true).description("启用国内必应图搜兜底（免 key，海外图源不可达时回退）")
});
const GALLERY_SECTION_TEXT = `You can display a set of images INSIDE your reply by emitting a fenced block with the language tag \`dsh-gallery\` containing a JSON object:

\`\`\`dsh-gallery
{"title":"可选标题","filtered":true,"images":[{"url":"https://...","alt":"简短替代文字","caption":"一句话说明","source":"Wikimedia Commons","sourceUrl":"https://原图页面"}]}
\`\`\`

The block renders as a horizontally scrollable card of thumbnails; tapping one opens a larger view with its caption and source.

Contract rules:
- \`url\` must be https (no data: URLs, no local paths); max 8 images per card; unknown fields are ignored; invalid JSON degrades to a plain code block.
- Use the candidate's \`url\` field from image_search AS-IS (it is already the display-optimized image, e.g. a 480px thumbnail); put the candidate's \`sourceUrl\` into the fence's \`sourceUrl\`.
- \`filtered\`: true only when every image passed vision_curate (relevant=true and safety=true). When the vision service is unconfigured or curation failed, set false and tell the user in surrounding text that the images are unfiltered search results.

Workflow when the user wants images (参考图/素材/概念配图):
1. Call image_search(query, n) to fetch candidates (Wikimedia/Openverse，CC 授权；海外图源不可达时自动回退国内必应图搜)。
2. When image_search reports filteredByVision=true, call vision_curate({images, topic}) on the candidates; keep only relevant=true && safety=true items and use their captions.
3. Emit ONE dsh-gallery fence with the kept images (≤8). Do not dump long URL lists as plain text; a short text lead-in around the fence is fine.
4. If vision is unconfigured or curation fails: still show results but emit filtered:false and clearly say 未经视觉模型复核; prefer the 国内必应 results in this case (strict safe search + relevance ranking, zero-config safety fallback).
5. Never invent image URLs; only use urls returned by image_search. If search returns nothing, say so and offer to reword the query.`;
const inject = ["systemPrompt", "settings"];
function apply(ctx) {
	ctx.systemPrompt.section({
		name: "gallery:fence",
		order: 106,
		text: GALLERY_SECTION_TEXT
	});
	const scope = ctx.settings.register(SETTINGS_NAMESPACE, Config);
	const adoptSettings = () => {
		setRuntimeSettings(scope.get());
	};
	adoptSettings();
	scope.watch(adoptSettings);
	let registered = false;
	const tryRegister = (value) => {
		if (registered) return;
		const tools = value ?? ctx.reflect.get("tools", false);
		if (tools === void 0) return;
		tools.register(createImageSearchTool());
		tools.register(createVisionCurateTool());
		registered = true;
	};
	tryRegister(void 0);
	ctx.on("internal/service", (name, value) => {
		if (name === "tools") tryRegister(value);
	});
	let credentialsWired = false;
	const tryWireCredentials = (value) => {
		if (credentialsWired) return;
		const credentials = value ?? ctx.reflect.get("credentials", false);
		if (credentials === void 0) return;
		setVisionKeyResolver(async () => (await credentials.resolve(CREDENTIAL_REF))?.value);
		credentialsWired = true;
	};
	tryWireCredentials(void 0);
	ctx.on("internal/service", (name, value) => {
		if (name === "credentials") tryWireCredentials(value);
	});
}
//#endregion
export { CREDENTIAL_REF, Config, GALLERY_SECTION_ORDER, GALLERY_SECTION_TEXT, SETTINGS_NAMESPACE, apply, inject };
