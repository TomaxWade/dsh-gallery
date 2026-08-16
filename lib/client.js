window.__ModuleLoader__.load({ id: "dsh-gallery", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) {
				__defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
		}
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let react = require("react");
react = __toESM(react, 1);
let react_dom_client = require("react-dom/client");
let react_jsx_runtime = require("react/jsx-runtime");

//#region src/shared/payload.ts
/** Whitelist payload: https urls only, unknown fields dropped, cap 8 images. */
function parsePayload(raw) {
	if (raw === null || typeof raw !== "object") return null;
	const record = raw;
	if (!Array.isArray(record.images)) return null;
	const images = [];
	for (const entry of record.images.slice(0, 8)) {
		if (entry === null || typeof entry !== "object") continue;
		const img = entry;
		if (typeof img.url !== "string" || !img.url.startsWith("https://")) continue;
		const item = { url: img.url };
		if (typeof img.alt === "string") item.alt = img.alt.slice(0, 200);
		if (typeof img.caption === "string") item.caption = img.caption.slice(0, 200);
		if (typeof img.source === "string") item.source = img.source.slice(0, 100);
		if (typeof img.sourceUrl === "string" && img.sourceUrl.startsWith("https://")) item.sourceUrl = img.sourceUrl;
		images.push(item);
	}
	if (images.length === 0) return null;
	return {
		...typeof record.title === "string" ? { title: record.title.slice(0, 120) } : {},
		...record.filtered === false ? { filtered: false } : {},
		images
	};
}
/** Parse a raw fence body (JSON text) and whitelist it; null keeps the stock code block. */
function parseFenceText(raw) {
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	return parsePayload(parsed);
}

//#endregion
//#region src/client/GalleryCard.tsx
/**
* The horizontally scrollable image card: one row of thumbnails, tap to open
* a lightbox with caption + source link. Inline styles only (no CSS build
* step); all images are external https URLs with no-referrer to dodge
* hotlink blocks.
*/
const CARD = {
	display: "flex",
	flexDirection: "column",
	gap: 8,
	maxWidth: 640,
	margin: "4px 0"
};
const HEADER = {
	display: "flex",
	alignItems: "center",
	gap: 8,
	fontSize: 13,
	fontWeight: 600,
	color: "var(--dsw-alias-label-primary, #e5e7eb)"
};
const BADGE = {
	fontSize: 11,
	fontWeight: 500,
	padding: "1px 8px",
	borderRadius: 999,
	background: "rgba(180,150,60,0.18)",
	color: "#d9b25f"
};
const ROW = {
	display: "flex",
	gap: 10,
	overflowX: "auto",
	overflowY: "hidden",
	paddingBottom: 6,
	scrollbarWidth: "thin"
};
const THUMB = {
	height: 150,
	minWidth: 210,
	maxWidth: 260,
	objectFit: "cover",
	borderRadius: 10,
	background: "rgba(128,128,128,0.18)",
	cursor: "zoom-in",
	flex: "0 0 auto",
	border: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08))"
};
const OVERLAY = {
	position: "fixed",
	inset: 0,
	zIndex: 1e3,
	background: "rgba(8,10,14,0.86)",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: 12,
	padding: "24px 16px",
	cursor: "zoom-out"
};
const OVERLAY_IMG = {
	maxWidth: "92%",
	maxHeight: "78vh",
	objectFit: "contain",
	borderRadius: 8
};
const CAPTION = {
	color: "#e5e7eb",
	fontSize: 14,
	maxWidth: "92%",
	textAlign: "center"
};
const SOURCE_LINK = {
	color: "#8fb7e8",
	fontSize: 12,
	textDecoration: "underline"
};
function GalleryCard({ payload }) {
	const [openIndex, setOpenIndex] = react.useState(null);
	react.useEffect(() => {
		if (openIndex === null) return;
		const onKey = (event) => {
			if (event.key === "Escape") setOpenIndex(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [openIndex]);
	const open = openIndex !== null ? payload.images[openIndex] : void 0;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: CARD,
		children: [
			payload.title !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: HEADER,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: payload.title }), payload.filtered === false && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: BADGE,
					children: "未筛选"
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: ROW,
				children: payload.images.map((image, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					src: image.url,
					alt: image.alt ?? image.caption ?? `图片 ${index + 1}`,
					title: image.caption ?? image.alt,
					loading: "lazy",
					referrerPolicy: "no-referrer",
					style: THUMB,
					onClick: () => setOpenIndex(index),
					onError: (event) => {
						event.currentTarget.style.display = "none";
					}
				}, `${image.url.slice(0, 80)}:${index}`))
			}),
			open !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: OVERLAY,
				onClick: () => setOpenIndex(null),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						src: open.url,
						alt: open.alt ?? open.caption ?? "原图",
						referrerPolicy: "no-referrer",
						style: OVERLAY_IMG,
						onClick: (event) => event.stopPropagation()
					}),
					(open.caption !== void 0 || open.source !== void 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: CAPTION,
						onClick: (event) => event.stopPropagation(),
						children: [
							open.caption,
							open.caption !== void 0 && open.source !== void 0 ? " · " : "",
							open.source
						]
					}),
					open.sourceUrl !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						style: SOURCE_LINK,
						href: open.sourceUrl,
						target: "_blank",
						rel: "noreferrer noopener",
						onClick: (event) => event.stopPropagation(),
						children: "查看来源"
					})
				]
			})
		]
	});
}

//#endregion
//#region src/client/dom-fence.tsx
/**
* DOM render channel for pristine hosts (stock rc.6 has no fence-registry):
* observes the conversation DOM, finds settled stock code blocks labelled
* `dsh-gallery` (`.md-code-block` surface, label leaf outside the `<pre>`),
* parses the fence JSON and mounts the plugin's own React root next to the
* hidden stock block. Pattern proven by dsh-genui's dom-fence; simplified:
* no streaming partial takeover (a fence renders once its JSON parses), a 1s
* sweep re-applies hides/updates that host re-renders may wipe.
*/
const LANG = "dsh-gallery";
const PROCESSED = "data-dsh-gallery-rendered";
const SELECTORS = ".md-code-block, .code-block, .code-block-small";
const SWEEP_MS = 1e3;
const mounts = [];
/** Language label: a leaf element with exactly the lang text, outside the `<pre>` body. */
function labelOf(block) {
	const pre = block.querySelector("pre");
	for (const el of block.querySelectorAll("*")) {
		if (el.childElementCount !== 0) continue;
		if (pre !== null && pre.contains(el)) continue;
		if ((el.textContent ?? "").trim() === LANG) return LANG;
	}
	return "";
}
function rawOf(block) {
	return block.querySelector("pre")?.textContent ?? "";
}
/** Parse the fence body and whitelist it; null keeps the stock code block. */
function payloadOf(block) {
	return parseFenceText(rawOf(block));
}
/** Mount the card beside a stock block (hidden) once its JSON parses. */
function takeOver(block) {
	if (block.hasAttribute(PROCESSED)) return;
	const payload = payloadOf(block);
	if (payload === null) return;
	const container = document.createElement("div");
	block.after(container);
	block.style.display = "none";
	block.setAttribute(PROCESSED, "");
	const root = (0, react_dom_client.createRoot)(container);
	root.render(react.createElement(GalleryCard, { payload }));
	mounts.push({
		root,
		container,
		block,
		lastRaw: rawOf(block)
	});
}
function scan(scope = document) {
	for (const el of scope.querySelectorAll(SELECTORS)) {
		if (el.parentElement !== null && el.parentElement.closest(SELECTORS) !== null) continue;
		if (el.hasAttribute(PROCESSED)) continue;
		if (labelOf(el) !== LANG) continue;
		takeOver(el);
	}
}
/** Drop mounts whose stock block left the DOM (branch switch, message removed). */
function sweepRemoved() {
	for (let i = mounts.length - 1; i >= 0; i -= 1) {
		const mount = mounts[i];
		if (!document.contains(mount.block)) {
			mount.root.unmount();
			mount.container.remove();
			mounts.splice(i, 1);
		}
	}
}
/** Re-apply hides wiped by host re-renders, and update parsed payloads. */
function sweepUpdates() {
	for (const mount of mounts) {
		if (mount.block.style.display !== "none") mount.block.style.display = "none";
		if (!mount.block.hasAttribute(PROCESSED)) mount.block.setAttribute(PROCESSED, "");
		const raw = rawOf(mount.block);
		if (raw === mount.lastRaw) continue;
		mount.lastRaw = raw;
		const payload = payloadOf(mount.block);
		if (payload !== null) mount.root.render(react.createElement(GalleryCard, { payload }));
	}
}
function installDomFenceRenderer() {
	if (typeof document === "undefined") return () => {};
	const observer = new MutationObserver(() => scan(document));
	observer.observe(document.body, {
		childList: true,
		subtree: true
	});
	const sweep = setInterval(() => {
		sweepRemoved();
		sweepUpdates();
		scan(document);
	}, SWEEP_MS);
	scan(document);
	return () => {
		observer.disconnect();
		clearInterval(sweep);
		for (const mount of mounts.splice(0)) {
			mount.root.unmount();
			mount.container.remove();
			mount.block.style.display = "";
			mount.block.removeAttribute(PROCESSED);
		}
	};
}

//#endregion
//#region src/client/settings.tsx
/**
* "视觉模型" 设置页：视觉模型 Key（credentials 服务，write-only）与
* 图库筛选配置（settings 命名空间 dsh-gallery）。注册在 settings.section。
*/
const KEY_REF = "DSH_GALLERY_VISION_KEY";
const NS = "dsh-gallery";
const FORM_DEFAULTS = {
	visionBaseURL: "",
	visionModel: "glm-4.6v-flash",
	maxCandidates: 6,
	sourcesWikimedia: true,
	sourcesOpenverse: true,
	sourcesBingCn: true
};
const STYLE = {
	root: {
		display: "flex",
		flexDirection: "column",
		gap: 12,
		padding: "16px 0",
		maxWidth: 560
	},
	title: {
		fontSize: 15,
		fontWeight: 600
	},
	card: {
		background: "var(--dsw-alias-bg-module-platform, rgba(255,255,255,0.04))",
		borderRadius: 12,
		padding: "12px 14px",
		display: "flex",
		flexDirection: "column",
		gap: 8,
		fontSize: 13,
		lineHeight: "20px",
		color: "var(--dsw-alias-label-primary, #e5e7eb)"
	},
	muted: {
		color: "var(--dsw-alias-label-secondary, #9ca3af)",
		fontSize: 12
	},
	code: {
		fontFamily: "var(--ds-font-family-code, monospace)",
		fontSize: 12
	},
	warn: {
		color: "#d9b25f",
		fontSize: 12
	},
	row: {
		display: "flex",
		gap: 8,
		alignItems: "center"
	},
	field: {
		display: "flex",
		flexDirection: "column",
		gap: 4
	},
	label: {
		fontSize: 12,
		color: "var(--dsw-alias-label-secondary, #9ca3af)"
	},
	input: {
		background: "var(--dsw-specific-input-major, rgba(0,0,0,0.25))",
		border: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.12))",
		borderRadius: 8,
		padding: "6px 10px",
		fontSize: 13,
		color: "var(--dsw-alias-label-primary, #e5e7eb)"
	},
	button: {
		background: "var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.1))",
		border: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.12))",
		borderRadius: 8,
		padding: "6px 14px",
		fontSize: 13,
		color: "var(--dsw-alias-label-primary, #e5e7eb)",
		cursor: "pointer"
	},
	status: {
		fontSize: 12,
		fontWeight: 600
	}
};
function statusLabel(configured) {
	if (configured === true) return {
		text: "已配置",
		color: "#6fbf8f"
	};
	if (configured === false) return {
		text: "未配置（筛选关闭，卡片将标注未筛选）",
		color: "#d9b25f"
	};
	return {
		text: "凭据状态不可读",
		color: "#9ca3af"
	};
}
function VisionSettingsSection({ credentials, settings }) {
	const [configured, setConfigured] = react.useState(null);
	const [keyValue, setKeyValue] = react.useState("");
	const [form, setForm] = react.useState(FORM_DEFAULTS);
	const [revision, setRevision] = react.useState(null);
	const [formLoaded, setFormLoaded] = react.useState(false);
	const [busy, setBusy] = react.useState(false);
	const [message, setMessage] = react.useState(null);
	react.useEffect(() => {
		if (credentials !== void 0) {
			let cancelled = false;
			credentials.describe({ refs: [KEY_REF] }).then((response) => {
				if (cancelled) return;
				setConfigured(response.result.ok ? response.result.value?.credentials[KEY_REF] !== void 0 : null);
			}).catch(() => {
				if (!cancelled) setConfigured(null);
			});
			return () => {
				cancelled = true;
			};
		}
	}, [credentials]);
	react.useEffect(() => {
		if (settings === void 0) return;
		let cancelled = false;
		settings.describe({}).then((response) => {
			if (cancelled || !response.result.ok) return;
			const view = response.result.value?.namespaces.find((entry) => entry.ns === NS);
			if (view === void 0) return;
			const value = view.value ?? {};
			setForm({
				visionBaseURL: typeof value.visionBaseURL === "string" ? value.visionBaseURL : FORM_DEFAULTS.visionBaseURL,
				visionModel: typeof value.visionModel === "string" ? value.visionModel : FORM_DEFAULTS.visionModel,
				maxCandidates: typeof value.maxCandidates === "number" ? value.maxCandidates : FORM_DEFAULTS.maxCandidates,
				sourcesWikimedia: typeof value.sourcesWikimedia === "boolean" ? value.sourcesWikimedia : FORM_DEFAULTS.sourcesWikimedia,
				sourcesOpenverse: typeof value.sourcesOpenverse === "boolean" ? value.sourcesOpenverse : FORM_DEFAULTS.sourcesOpenverse,
				sourcesBingCn: typeof value.sourcesBingCn === "boolean" ? value.sourcesBingCn : FORM_DEFAULTS.sourcesBingCn
			});
			setRevision(view.revision);
			setFormLoaded(true);
		}).catch(() => {
			if (!cancelled) setFormLoaded(false);
		});
		return () => {
			cancelled = true;
		};
	}, [settings]);
	const saveKey = async () => {
		if (credentials === void 0 || keyValue.trim().length === 0) return;
		setBusy(true);
		setMessage(null);
		try {
			const response = await credentials.set({
				ref: KEY_REF,
				value: keyValue.trim()
			});
			if (response.result.ok) {
				setConfigured(true);
				setKeyValue("");
				setMessage("已保存到本机凭据（write-only，不回显）");
			} else setMessage(response.result.error?.message ?? "保存失败");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "保存失败");
		} finally {
			setBusy(false);
		}
	};
	const clearKey = async () => {
		if (credentials === void 0) return;
		setBusy(true);
		setMessage(null);
		try {
			const response = await credentials.unset({ ref: KEY_REF });
			if (response.result.ok) {
				setConfigured(false);
				setMessage("已清除");
			} else setMessage(response.result.error?.message ?? "清除失败");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "清除失败");
		} finally {
			setBusy(false);
		}
	};
	const saveForm = async () => {
		if (settings === void 0 || revision === null) return;
		setBusy(true);
		setMessage(null);
		try {
			const ops = [
				{
					op: "set",
					path: ["visionBaseURL"],
					value: form.visionBaseURL.trim()
				},
				{
					op: "set",
					path: ["visionModel"],
					value: form.visionModel.trim()
				},
				{
					op: "set",
					path: ["maxCandidates"],
					value: Math.min(12, Math.max(1, Math.round(form.maxCandidates)))
				},
				{
					op: "set",
					path: ["sourcesWikimedia"],
					value: form.sourcesWikimedia
				},
				{
					op: "set",
					path: ["sourcesOpenverse"],
					value: form.sourcesOpenverse
				},
				{
					op: "set",
					path: ["sourcesBingCn"],
					value: form.sourcesBingCn
				}
			];
			const response = await settings.mutate({
				ns: NS,
				ops,
				expectedRevision: revision
			});
			if (response.result.ok) {
				setRevision(response.result.value?.revision ?? revision);
				setMessage("设置已保存（即时生效）");
			} else setMessage(response.result.error?.message ?? "保存失败（可能被其他改动抢先，请重试）");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "保存失败");
		} finally {
			setBusy(false);
		}
	};
	const status = statusLabel(configured);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: STYLE.root,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: STYLE.title,
				children: "视觉模型（dsh-gallery）"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: STYLE.card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: STYLE.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "筛选模型 Key：" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								...STYLE.status,
								color: status.color
							},
							children: status.text
						})]
					}),
					credentials !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: STYLE.row,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "password",
								style: {
									...STYLE.input,
									flex: 1
								},
								placeholder: "粘贴 API Key（仅存本机凭据，不回显）",
								value: keyValue,
								disabled: busy,
								onChange: (event) => setKeyValue(event.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: STYLE.button,
								disabled: busy || keyValue.trim().length === 0,
								onClick: () => void saveKey(),
								children: "保存"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: STYLE.button,
								disabled: busy,
								onClick: () => void clearKey(),
								children: "清除"
							})
						]
					}) }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: STYLE.warn,
						children: "凭据服务不可用：请改用环境变量 DSH_GALLERY_VISION_KEY 配置。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: STYLE.warn,
						children: "启用筛选后，搜索到的图片会发送给你选择的模型厂商进行识别。"
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: STYLE.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: { fontWeight: 600 },
					children: "筛选配置"
				}), settings !== void 0 && formLoaded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: STYLE.field,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: STYLE.label,
							children: "端点 Base URL（OpenAI 兼容，留空用默认）"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "text",
							style: STYLE.input,
							placeholder: "https://open.bigmodel.cn/api/paas/v4",
							value: form.visionBaseURL,
							disabled: busy,
							onChange: (event) => setForm({
								...form,
								visionBaseURL: event.target.value
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: STYLE.field,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: STYLE.label,
							children: "模型名"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "text",
							style: STYLE.input,
							value: form.visionModel,
							disabled: busy,
							onChange: (event) => setForm({
								...form,
								visionModel: event.target.value
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: STYLE.field,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: STYLE.label,
							children: "每次搜索候选数（1-12）"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 1,
							max: 12,
							style: STYLE.input,
							value: form.maxCandidates,
							disabled: busy,
							onChange: (event) => setForm({
								...form,
								maxCandidates: Number(event.target.value) || 1
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: STYLE.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: form.sourcesWikimedia,
							disabled: busy,
							onChange: (event) => setForm({
								...form,
								sourcesWikimedia: event.target.checked
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Wikimedia Commons（CC 授权，免 key）" })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: STYLE.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: form.sourcesOpenverse,
							disabled: busy,
							onChange: (event) => setForm({
								...form,
								sourcesOpenverse: event.target.checked
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Openverse（CC 授权，免 key）" })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: STYLE.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: form.sourcesBingCn,
							disabled: busy,
							onChange: (event) => setForm({
								...form,
								sourcesBingCn: event.target.checked
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "国内必应图搜（免 key，严格安全搜索；海外图源不可达时兜底）" })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: STYLE.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: STYLE.button,
							disabled: busy,
							onClick: () => void saveForm(),
							children: "保存设置"
						}), message !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: STYLE.muted,
							children: message
						})]
					})
				] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: STYLE.muted,
					children: "设置服务不可用或未加载：以上字段可通过环境变量配置（DSH_GALLERY_VISION_BASE_URL / DSH_GALLERY_VISION_MODEL），图源默认全部启用。"
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: STYLE.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: { fontWeight: 600 },
					children: "网络与代理"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: STYLE.code,
					children: "DSH_GALLERY_HTTPS_PROXY"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: STYLE.muted,
					children: "图源直连不可达时使用的本地代理（环境变量，启动 dsh web 前设置；默认回退读 HTTPS_PROXY/HTTP_PROXY）"
				})] })]
			})
		]
	});
}

//#endregion
//#region src/client/index.tsx
/**
* dsh-gallery browser half: installs the DOM fence renderer for
* ```dsh-gallery and the "视觉模型" settings section (with credential
* wiring via the connection service).
*/
const inject = ["slots", "connection"];
function apply(ctx) {
	const disposers = [];
	if (typeof document !== "undefined") {
		console.info("[dsh-gallery] DOM fence renderer installed");
		disposers.push(installDomFenceRenderer());
	}
	const credentials = ctx.connection?.api?.credentials;
	const settings = ctx.connection?.api?.settings;
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "dsh-gallery-vision",
		order: 90,
		label: "视觉模型"
	}, () => react.createElement(VisionSettingsSection, {
		credentials,
		settings
	})));
	return () => {
		for (const dispose of disposers) dispose();
	};
}

//#endregion
exports.apply = apply;
exports.inject = inject;
return module.exports; } });