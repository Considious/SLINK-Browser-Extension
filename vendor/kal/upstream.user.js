// ==UserScript==
// @name         KAL - Loadout Revealer
// @namespace    kal.loadouts
// @version      1.3.3
// @author       Kalends [2032147]
// @description  Kal's Augmented Loadouts: capture and reveal shared Torn loadouts.
// @license      All Rights Reserved
// @downloadURL  https://kalends.dev/userscripts/kal-loadout-revealer.user.js
// @updateURL    https://kalends.dev/userscripts/kal-loadout-revealer.meta.js
// @match        https://www.torn.com/page.php*
// @match        https://www.torn.com/profiles.php*
// @connect      kalends.dev
// @grant        GM.deleteValue
// @grant        GM.getValue
// @grant        GM.info
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
	"use strict";
	var pendingWrites = new Map();
	function mutationKey(scope, key) {
		return `${scope}:${key}`;
	}
	function mutate(scope, key, operation) {
		const queuedKey = mutationKey(scope, key);
		const next = (pendingWrites.get(queuedKey) ?? Promise.resolve()).catch(() => {}).then(operation);
		pendingWrites.set(queuedKey, next);
		next.finally(() => {
			if (pendingWrites.get(queuedKey) === next) pendingWrites.delete(queuedKey);
		}).catch(() => {});
		return next;
	}
	function nativePdaStorage() {
		try {
			if (typeof PDA_storage === "undefined" || !PDA_storage) return null;
			if (typeof PDA_storage.get !== "function" || typeof PDA_storage.set !== "function" || typeof PDA_storage.delete !== "function") return null;
			return PDA_storage;
		} catch {
			return null;
		}
	}
	async function loadGmValue(key, fallback, strict) {
		if (typeof GM === "undefined" || typeof GM.getValue !== "function") {
			if (strict) throw new Error("Userscript storage is unavailable.");
			return fallback;
		}
		try {
			const value = await GM.getValue(key, fallback);
			return value === void 0 ? fallback : value;
		} catch (error) {
			if (strict) throw error;
			return fallback;
		}
	}
	function selectedStorageBackend() {
		const pda = nativePdaStorage();
		if (pda) return {
			scope: "pda",
			async get(key, fallback, strict) {
				try {
					const value = await pda.get(key, fallback);
					return value === void 0 ? fallback : value;
				} catch (error) {
					if (strict) throw error;
					return fallback;
				}
			},
			set: (key, value) => pda.set(key, value),
			delete: (key) => pda.delete(key)
		};
		return {
			scope: "gm",
			get: loadGmValue,
			async set(key, value) {
				if (typeof GM === "undefined" || typeof GM.setValue !== "function") throw new Error("Userscript storage is unavailable.");
				await GM.setValue(key, value);
			},
			async delete(key) {
				if (typeof GM === "undefined" || typeof GM.deleteValue !== "function") throw new Error("Userscript storage is unavailable.");
				await GM.deleteValue(key);
			}
		};
	}
	function usingNativePdaStorage() {
		return nativePdaStorage() !== null;
	}
	async function loadStoredValue(key, fallback, strict = false) {
		return selectedStorageBackend().get(key, fallback, strict);
	}
	function loadLegacyGmValue(key, fallback, strict = false) {
		return loadGmValue(key, fallback, strict);
	}
	async function saveStoredValue(key, value) {
		const backend = selectedStorageBackend();
		await mutate(backend.scope, key, () => backend.set(key, value));
	}
	async function updateStoredValue(key, fallback, update, strict = true) {
		const backend = selectedStorageBackend();
		let updated;
		await mutate(backend.scope, key, async () => {
			updated = await update(await backend.get(key, fallback, strict));
			if (typeof updated !== "string" && typeof updated !== "number" && typeof updated !== "boolean") throw new TypeError("Userscript storage values must be primitive/encoded.");
			await backend.set(key, updated);
		});
		return updated;
	}
	async function removeStoredValue(key) {
		const backend = selectedStorageBackend();
		await mutate(backend.scope, key, () => backend.delete(key));
	}
	async function removeLegacyGmValue(key) {
		if (typeof GM === "undefined" || typeof GM.deleteValue !== "function") throw new Error("Userscript storage is unavailable.");
		const gm = GM;
		await mutate("gm", key, async () => {
			await gm.deleteValue(key);
		});
	}
	var W = window;
	function unwrapWindow(value) {
		try {
			const wrapped = value.wrappedJSObject;
			if (wrapped && (typeof wrapped === "object" || typeof wrapped === "function")) return wrapped;
		} catch {}
		return value;
	}
	var RAW_PAGE_W = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
	var PAGE_W = unwrapWindow(RAW_PAGE_W);
	function reportedInjectionMode() {
		try {
			if (typeof GM === "undefined") return null;
			return GM.info?.injectInto ?? GM.info?.script?.["inject-into"] ?? null;
		} catch {
			return null;
		}
	}
	function directPageRealmAvailable() {
		if (PAGE_W !== RAW_PAGE_W) return true;
		if (reportedInjectionMode() === "content") return false;
		if (typeof unsafeWindow !== "undefined") return true;
		if (PAGE_W !== W) return true;
		return typeof GM === "undefined";
	}
	function pageFunction(callback, host = PAGE_W) {
		if (host !== PAGE_W || typeof exportFunction !== "function") return callback;
		return exportFunction(callback, host);
	}
	function pageObject(value, host = PAGE_W) {
		if (host !== PAGE_W || typeof cloneInto !== "function") return value;
		return cloneInto(value, host);
	}
	function pageJsonClone(value, host = PAGE_W) {
		const serialized = JSON.stringify(value);
		if (serialized === void 0) throw new TypeError("Value is not JSON-serializable");
		const pageJson = host.JSON;
		return Reflect.apply(pageJson.parse, pageJson, [serialized]);
	}
	function pageThen(promise, onFulfilled, onRejected, host = PAGE_W) {
		const fulfilled = pageFunction(onFulfilled, host);
		const rejected = onRejected ? pageFunction(onRejected, host) : void 0;
		return Reflect.apply(promise.then, promise, [fulfilled, rejected]);
	}
	function publishPageFunction(host, name, callback) {
		try {
			if (host === PAGE_W && typeof exportFunction === "function") exportFunction(callback, host, { defineAs: name });
			else host[name] = callback;
			return true;
		} catch {
			return false;
		}
	}
	var SCRIPT_NAME = "KAL - Loadout Revealer";
	var SCRIPT_VERSION = "1.3.3";
	var API_BASE = "https://kalends.dev/api";
	var RENDER_TIMEOUT_MS = 15e3;
	function positiveInteger(value) {
		const number = Number(value);
		return Number.isSafeInteger(number) && number > 0 ? number : null;
	}
	function objectRecord(value) {
		return value !== null && typeof value === "object" && !Array.isArray(value);
	}
	function validTimestamp(value) {
		return typeof value === "string" && Number.isFinite(Date.parse(value));
	}
	function describePage() {
		const query = new URLSearchParams(W.location.search);
		if (W.location.pathname === "/page.php" && query.get("sid") === "attack") return {
			type: "attack",
			playerId: positiveInteger(query.get("user2ID"))
		};
		if (W.location.pathname === "/profiles.php") return {
			type: "profile",
			playerId: positiveInteger(query.get("XID"))
		};
		return {
			type: "unsupported",
			playerId: null
		};
	}
	var PAGE = Object.freeze(describePage());
	var EVENT_NPC_IDS = new Set([
		23,
		100,
		101,
		102,
		103,
		104,
		777
	]);
	var EVENT_NPC_ATTACK = PAGE.type === "attack" && EVENT_NPC_IDS.has(PAGE.playerId ?? 0);
	function parseJson(text) {
		try {
			return JSON.parse(text);
		} catch {
			return null;
		}
	}
	function warn(context, error = null, details = null) {
		let message = error;
		try {
			if (error && typeof error === "object" && "message" in error) message = error.message;
		} catch {
			message = "[unreadable cross-realm error]";
		}
		W.console?.warn?.(`[${SCRIPT_NAME}]`, context, message || "", details || "");
	}
	function runSafely(context, operation) {
		let result;
		try {
			result = typeof operation === "function" ? operation() : operation;
		} catch (error) {
			warn(context, error);
			return Promise.resolve(null);
		}
		return Promise.resolve(result).catch((error) => {
			warn(context, error);
			return null;
		});
	}
	function tornNow() {
		let reported;
		try {
			const clock = PAGE_W.getCurrentTimestamp;
			reported = typeof clock === "function" ? Reflect.apply(clock, PAGE_W, []) : void 0;
		} catch {
			return Date.now();
		}
		if (typeof reported === "number" && Number.isFinite(reported) && reported > 0) return reported < 0xe8d4a51000 ? reported * 1e3 : reported;
		return Date.now();
	}
	function formatCaptureAge(value, format = "long") {
		const elapsedMs = tornNow() - new Date(value).getTime();
		const compact = format === "compact";
		if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return compact ? "" : "unknown";
		const minutes = Math.floor(elapsedMs / 6e4);
		if (minutes < 1) return compact ? "now" : "just now";
		if (minutes < 60) return compact ? `${minutes}m ago` : `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return compact ? `${hours}h ago` : `${hours} hour${hours === 1 ? "" : "s"} ago`;
		const days = Math.floor(hours / 24);
		if (compact) {
			if (days < 30) return `${days}d ago`;
			if (days < 365) return `${Math.floor(days / 30)}mo ago`;
			return `${Math.floor(days / 365)}y ago`;
		}
		if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
		if (days < 30) {
			const weeks = Math.floor(days / 7);
			return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
		}
		if (days < 365) {
			const months = Math.floor(days / 30);
			return `${months} month${months === 1 ? "" : "s"} ago`;
		}
		const years = Math.floor(days / 365);
		return `${years} year${years === 1 ? "" : "s"} ago`;
	}
	function waitForElement(selector, timeout = RENDER_TIMEOUT_MS) {
		return new Promise((resolve) => {
			const existing = W.document.querySelector(selector);
			if (existing) {
				resolve(existing);
				return;
			}
			const observer = new MutationObserver(() => {
				const element = W.document.querySelector(selector);
				if (!element) return;
				observer.disconnect();
				W.clearTimeout(timer);
				resolve(element);
			});
			observer.observe(W.document.documentElement, {
				childList: true,
				subtree: true
			});
			const timer = W.setTimeout(() => {
				observer.disconnect();
				resolve(null);
			}, timeout);
		});
	}
	var STORAGE_KEYS = Object.freeze({
		apiKey: "kal_api_key",
		preferences: "kal_preferences",
		account: "kal_account",
		notifications: "kal_notifications"
	});
	var LEGACY_STORAGE_KEYS = Object.freeze({
		apiKey: "kal_loadout_api_key",
		connectedTornId: "kal_loadout_connected_torn_id",
		pendingNotification: "kal_loadout_pending_notification",
		preferences: Object.freeze({
			showAttackLoadouts: "kal_loadout_attack_display",
			showProfileLoadouts: "kal_loadout_profile_display",
			showProfileJobSpecials: "kal_loadout_profile_job_specials",
			hideProfileLoadoutOnOwnPage: "kal_loadout_profile_hide_own_page",
			keepBonusLabelsVisible: "kal_loadout_keep_bonus_labels",
			hideCosmeticsInFights: "kal_loadout_hide_cosmetics",
			profileCollapsed: "kal_loadout_profile_collapsed",
			retiredInstantHistory: "kal_loadout_instant_history"
		})
	});
	function readLegacyValue(key, fallback, strict = false) {
		return loadLegacyGmValue(key, fallback, strict);
	}
	async function persistMigratedValue(finalKey, encoded, decode, sourceKeys, label) {
		try {
			await saveStoredValue(finalKey, encoded);
			if (sourceKeys.length > 0) {
				if (decode(await loadStoredValue(finalKey, null, true)) === null) throw new Error(`Migrated ${label} value was not persisted.`);
			}
			for (const sourceKey of new Set(sourceKeys)) try {
				await removeLegacyGmValue(sourceKey);
			} catch (error) {
				warn(`Could not remove migrated KAL ${label} source`, error, { sourceKey });
			}
			return true;
		} catch (error) {
			warn(`Could not migrate KAL ${label} storage`, error);
			return false;
		}
	}
	async function promoteFinalGmValue(finalKey, decode, label) {
		if (!usingNativePdaStorage()) return {
			found: false,
			value: null,
			persistenceAllowed: true
		};
		const raw = await loadLegacyGmValue(finalKey, null, true);
		const racedFinal = await loadStoredValue(finalKey, null, true);
		if (racedFinal !== null && racedFinal !== void 0) {
			const racedValue = decode(racedFinal);
			return {
				found: true,
				value: racedValue,
				persistenceAllowed: racedValue !== null
			};
		}
		if (raw === null || raw === void 0) return {
			found: false,
			value: null,
			persistenceAllowed: true
		};
		const value = decode(raw);
		if (value === null) return {
			found: true,
			value: null,
			persistenceAllowed: false
		};
		return {
			found: true,
			value,
			persistenceAllowed: await persistMigratedValue(finalKey, raw, decode, [finalKey], label)
		};
	}
	async function readOriginalPreferenceValues() {
		const values = await Promise.all(Object.entries(LEGACY_STORAGE_KEYS.preferences).map(async ([name, key]) => ({
			name,
			key,
			value: await readLegacyValue(key, null, true)
		})));
		const result = {};
		const sourceKeys = [];
		for (const { name, key, value } of values) {
			if (value === null || value === void 0) continue;
			result[name] = value;
			sourceKeys.push(key);
		}
		return {
			values: result,
			sourceKeys
		};
	}
	var ACCOUNT_SCHEMA = 1;
	var apiKey = "";
	var connectedId = null;
	var accountPersistenceAllowed = true;
	var accountInitialization = null;
	function accountRecord(raw) {
		if (typeof raw !== "string") return null;
		const decoded = parseJson(raw);
		if (!objectRecord(decoded) || Number(decoded.schema) !== ACCOUNT_SCHEMA) return null;
		return decoded;
	}
	function apiKeyRecord(raw) {
		if (typeof raw !== "string") return null;
		return raw.trim() || null;
	}
	async function initializeAccountStorageNow() {
		accountPersistenceAllowed = true;
		connectedId = null;
		let stored;
		try {
			stored = await loadStoredValue(STORAGE_KEYS.account, null, true);
		} catch {
			accountPersistenceAllowed = false;
			return;
		}
		if (stored !== null && stored !== void 0) {
			const existing = accountRecord(stored);
			if (!existing) {
				accountPersistenceAllowed = false;
				return;
			}
			connectedId = positiveInteger(existing.tornId);
			return;
		}
		try {
			const promoted = await promoteFinalGmValue(STORAGE_KEYS.account, accountRecord, "account");
			if (promoted.found) {
				accountPersistenceAllowed = promoted.persistenceAllowed;
				connectedId = positiveInteger(promoted.value?.tornId);
				return;
			}
		} catch {
			accountPersistenceAllowed = false;
			return;
		}
		let migrationId = null;
		try {
			migrationId = await readLegacyValue(LEGACY_STORAGE_KEYS.connectedTornId, null, true);
		} catch {
			accountPersistenceAllowed = false;
			return;
		}
		try {
			const racedFinal = await loadStoredValue(STORAGE_KEYS.account, null, true);
			if (racedFinal !== null && racedFinal !== void 0) {
				const existing = accountRecord(racedFinal);
				if (!existing) {
					accountPersistenceAllowed = false;
					return;
				}
				connectedId = positiveInteger(existing.tornId);
				return;
			}
		} catch {
			accountPersistenceAllowed = false;
			return;
		}
		connectedId = positiveInteger(migrationId);
		const document = JSON.stringify({
			schema: ACCOUNT_SCHEMA,
			tornId: connectedId
		});
		accountPersistenceAllowed = await persistMigratedValue(STORAGE_KEYS.account, document, accountRecord, migrationId !== null && migrationId !== void 0 ? [LEGACY_STORAGE_KEYS.connectedTornId] : [], "account");
	}
	function initializeAccountStorage() {
		if (!accountInitialization) accountInitialization = initializeAccountStorageNow();
		return accountInitialization;
	}
	async function initializeApiKeyStorage() {
		let stored;
		try {
			stored = await loadStoredValue(STORAGE_KEYS.apiKey, null, true);
		} catch {
			apiKey = "";
			return;
		}
		if (stored !== null && stored !== void 0) {
			apiKey = typeof stored === "string" ? stored.trim() : "";
			return;
		}
		try {
			const promoted = await promoteFinalGmValue(STORAGE_KEYS.apiKey, apiKeyRecord, "API key");
			if (promoted.found) {
				apiKey = promoted.value ?? "";
				return;
			}
		} catch {
			apiKey = "";
			return;
		}
		let legacy;
		try {
			legacy = await readLegacyValue(LEGACY_STORAGE_KEYS.apiKey, null, true);
		} catch {
			apiKey = "";
			return;
		}
		try {
			const racedFinal = await loadStoredValue(STORAGE_KEYS.apiKey, null, true);
			if (racedFinal !== null && racedFinal !== void 0) {
				apiKey = typeof racedFinal === "string" ? racedFinal.trim() : "";
				return;
			}
		} catch {
			apiKey = "";
			return;
		}
		const migrated = apiKeyRecord(legacy) ?? "";
		if (!migrated) {
			apiKey = "";
			return;
		}
		apiKey = migrated;
		await persistMigratedValue(STORAGE_KEYS.apiKey, migrated, apiKeyRecord, [LEGACY_STORAGE_KEYS.apiKey], "API key");
	}
	function storedAPIKey() {
		return apiKey;
	}
	async function saveAPIKey(value) {
		const key = value.trim();
		try {
			await saveStoredValue(STORAGE_KEYS.apiKey, key);
			if (await loadStoredValue(STORAGE_KEYS.apiKey, "", true) !== key) throw new Error("Credential write was not persisted.");
		} catch {
			throw new Error("Could not save your API key. Check userscript storage and try again.");
		}
		apiKey = key;
	}
	async function saveConnectedTornId(tornId) {
		if (!Number.isSafeInteger(tornId) || tornId <= 0) return;
		await initializeAccountStorage();
		connectedId = tornId;
		if (!accountPersistenceAllowed) return;
		await updateStoredValue(STORAGE_KEYS.account, null, (raw) => {
			const current = accountRecord(raw);
			if (!current) throw new Error("Current account document is not writable by this script version.");
			return JSON.stringify({
				...current,
				schema: ACCOUNT_SCHEMA,
				tornId
			});
		});
	}
	function connectedTornId() {
		return connectedId;
	}
	function clearAuthenticationRuntime() {
		apiKey = "";
		connectedId = null;
	}
	async function clearPersistedAccountIdentity() {
		await initializeAccountStorage();
		connectedId = null;
		if (!accountPersistenceAllowed) return;
		try {
			await updateStoredValue(STORAGE_KEYS.account, null, (raw) => {
				const current = accountRecord(raw);
				if (!current) throw new Error("Current account document is not writable by this script version.");
				return JSON.stringify({
					...current,
					schema: ACCOUNT_SCHEMA,
					tornId: null
				});
			});
		} catch (error) {
			warn("Could not clear connected Torn ID from KAL account storage", error);
		}
	}
	async function removeStoredAuthentication(expectedCredential = null) {
		if (expectedCredential) {
			const persisted = apiKeyRecord(await loadStoredValue(STORAGE_KEYS.apiKey, null, true));
			if (persisted && persisted !== expectedCredential) return;
		}
		const [keyRemoval, _accountCleanup, finalGmRemoval, migrationKeyRemoval] = await Promise.allSettled([
			removeStoredValue(STORAGE_KEYS.apiKey),
			clearPersistedAccountIdentity(),
			removeLegacyGmValue(STORAGE_KEYS.apiKey),
			removeLegacyGmValue(LEGACY_STORAGE_KEYS.apiKey)
		]);
		if (keyRemoval?.status === "rejected") throw keyRemoval.reason;
		if (finalGmRemoval?.status === "rejected") throw finalGmRemoval.reason;
		if (migrationKeyRemoval?.status === "rejected") throw migrationKeyRemoval.reason;
		const remainingKey = await loadStoredValue(STORAGE_KEYS.apiKey, null, true);
		if (typeof remainingKey === "string" && remainingKey.trim()) throw new Error("Credential deletion was not persisted.");
		const finalGmKey = await readLegacyValue(STORAGE_KEYS.apiKey, null, true);
		if (typeof finalGmKey === "string" && finalGmKey.trim()) throw new Error("GM fallback credential deletion was not persisted.");
		const migrationKey = await readLegacyValue(LEGACY_STORAGE_KEYS.apiKey, null, true);
		if (typeof migrationKey === "string" && migrationKey.trim()) throw new Error("Legacy credential deletion was not persisted.");
	}
	async function forgetAPIKey(expectedCredential = null) {
		if (expectedCredential && apiKey !== expectedCredential) return true;
		clearAuthenticationRuntime();
		try {
			await removeStoredAuthentication(expectedCredential);
			return true;
		} catch (error) {
			warn("Could not remove disconnected API key from storage", error);
			return false;
		}
	}
	function rejectAPIKey(expectedCredential = null) {
		if (expectedCredential !== null && apiKey !== expectedCredential) return false;
		clearAuthenticationRuntime();
		removeStoredAuthentication(expectedCredential).catch((error) => warn("Could not remove rejected API key from storage", error));
		return true;
	}
	var NOTIFICATIONS_SCHEMA = 1;
	var SCRIPT_UPDATE_URL = "https://kalends.dev/userscripts/kal-loadout-revealer.user.js";
	var mandatoryScriptUpgrade = null;
	function compareVersions(left, right) {
		const parse = (value) => value.split(".").slice(0, 4).map((part) => /^\d+$/.test(part) ? Number(part) : NaN);
		const a = parse(left);
		const b = parse(right);
		if (a.some((part) => !Number.isFinite(part)) || b.some((part) => !Number.isFinite(part))) return 0;
		for (let index = 0; index < 4; index += 1) {
			const av = a[index] || 0;
			const bv = b[index] || 0;
			if (av !== bv) return av > bv ? 1 : -1;
		}
		return 0;
	}
	function isNewerScriptVersion(value) {
		return typeof value === "string" && Boolean(value.trim()) && compareVersions(value.trim(), "1.3.3") > 0;
	}
	function safeHttpsUrl(raw) {
		if (typeof raw !== "string" || !raw.trim()) return null;
		try {
			const url = new URL(raw);
			return url.protocol === "https:" ? url : null;
		} catch {
			return null;
		}
	}
	function notificationHasExpired(notification) {
		return notification.expires_at !== null && Date.parse(notification.expires_at) <= tornNow();
	}
	function normalizeNotification(raw) {
		if (!objectRecord(raw)) return null;
		const id = positiveInteger(raw.id);
		const message = typeof raw.message === "string" ? raw.message.trim() : "";
		if (!id || !message) return null;
		const link = safeHttpsUrl(raw.link_url);
		const expiresAt = typeof raw.expires_at === "string" && validTimestamp(raw.expires_at) ? raw.expires_at : null;
		return {
			id,
			message: message.slice(0, 500),
			link_url: link?.href ?? null,
			link_label: link && typeof raw.link_label === "string" && raw.link_label.trim() ? raw.link_label.trim().slice(0, 60) : null,
			expires_at: expiresAt
		};
	}
	var pendingNotification = null;
	var notificationMutationGeneration = 0;
	var notificationPersistenceAllowed = true;
	var notificationInitialization = null;
	function finalNotificationRecord(raw) {
		if (typeof raw !== "string") return null;
		const decoded = parseJson(raw);
		if (!objectRecord(decoded) || Number(decoded.schema) !== NOTIFICATIONS_SCHEMA) return null;
		return decoded;
	}
	function decodePendingFromDocument(document) {
		const notification = normalizeNotification(document.pending);
		return notification && !notificationHasExpired(notification) ? notification : null;
	}
	function persistPendingMutation(mutation) {
		if (!notificationPersistenceAllowed) return;
		const generation = notificationMutationGeneration;
		updateStoredValue(STORAGE_KEYS.notifications, null, (raw) => {
			const document = finalNotificationRecord(raw);
			if (!document) throw new Error("Current notification document is not writable by this script version.");
			const next = mutation(decodePendingFromDocument(document));
			return JSON.stringify({
				...document,
				schema: NOTIFICATIONS_SCHEMA,
				pending: next
			});
		}).then((encoded) => {
			if (generation !== notificationMutationGeneration) return;
			const document = finalNotificationRecord(encoded);
			if (!document) return;
			pendingNotification = decodePendingFromDocument(document);
		}, (error) => warn("Could not persist KAL notification state", error));
	}
	async function initializeNotificationStorageNow() {
		pendingNotification = null;
		notificationPersistenceAllowed = true;
		let stored;
		try {
			stored = await loadStoredValue(STORAGE_KEYS.notifications, null, true);
		} catch {
			notificationPersistenceAllowed = false;
			return;
		}
		if (stored !== null && stored !== void 0) {
			const existing = finalNotificationRecord(stored);
			if (!existing) {
				notificationPersistenceAllowed = false;
				return;
			}
			pendingNotification = decodePendingFromDocument(existing);
			if (existing.pending !== null && !pendingNotification) persistPendingMutation((current) => current);
			return;
		}
		try {
			const promoted = await promoteFinalGmValue(STORAGE_KEYS.notifications, finalNotificationRecord, "notification");
			if (promoted.found) {
				notificationPersistenceAllowed = promoted.persistenceAllowed;
				if (promoted.value) pendingNotification = decodePendingFromDocument(promoted.value);
				return;
			}
		} catch {
			notificationPersistenceAllowed = false;
			return;
		}
		let legacy = null;
		try {
			legacy = await readLegacyValue(LEGACY_STORAGE_KEYS.pendingNotification, null, true);
		} catch {
			notificationPersistenceAllowed = false;
			return;
		}
		try {
			const racedFinal = await loadStoredValue(STORAGE_KEYS.notifications, null, true);
			if (racedFinal !== null && racedFinal !== void 0) {
				const existing = finalNotificationRecord(racedFinal);
				if (!existing) {
					notificationPersistenceAllowed = false;
					return;
				}
				pendingNotification = decodePendingFromDocument(existing);
				return;
			}
		} catch {
			notificationPersistenceAllowed = false;
			return;
		}
		const migrated = normalizeNotification(legacy);
		pendingNotification = migrated && !notificationHasExpired(migrated) ? migrated : null;
		const encoded = JSON.stringify({
			schema: NOTIFICATIONS_SCHEMA,
			pending: pendingNotification
		});
		notificationPersistenceAllowed = await persistMigratedValue(STORAGE_KEYS.notifications, encoded, finalNotificationRecord, legacy !== null && legacy !== void 0 ? [LEGACY_STORAGE_KEYS.pendingNotification] : [], "notification");
	}
	function initializeNotificationStorage() {
		if (!notificationInitialization) notificationInitialization = initializeNotificationStorageNow();
		return notificationInitialization;
	}
	function receiveNotification(notification) {
		const next = normalizeNotification(notification);
		if (!next || notificationHasExpired(next)) return;
		if (pendingNotification && pendingNotification.id >= next.id) return;
		pendingNotification = next;
		notificationMutationGeneration += 1;
		persistPendingMutation((current) => current && current.id >= next.id ? current : next);
	}
	function currentNotification() {
		if (pendingNotification && notificationHasExpired(pendingNotification)) {
			const expiredId = pendingNotification.id;
			pendingNotification = null;
			notificationMutationGeneration += 1;
			persistPendingMutation((current) => current?.id === expiredId ? null : current);
		}
		return pendingNotification;
	}
	function dismissNotification(notificationId) {
		if (pendingNotification?.id !== notificationId) return;
		pendingNotification = null;
		notificationMutationGeneration += 1;
		persistPendingMutation((current) => current?.id === notificationId ? null : current);
	}
	function renderProfileNotice({ message, linkUrl = null, linkLabel = null, dismissible = false, dismissLabel = "Dismiss", onDismiss = null }) {
		const banner = W.document.createElement("div");
		banner.className = "kal-profile-notification";
		banner.setAttribute("role", "status");
		const copy = W.document.createElement("div");
		copy.className = "kal-profile-notification-copy";
		const text = W.document.createElement("span");
		text.className = "kal-profile-notification-message";
		text.textContent = message;
		copy.appendChild(text);
		banner.appendChild(copy);
		const url = safeHttpsUrl(linkUrl);
		if (url) {
			const link = W.document.createElement("a");
			link.className = "kal-profile-notification-link";
			link.href = url.href;
			link.target = "_blank";
			link.rel = "noopener noreferrer nofollow";
			link.textContent = String(linkLabel || "Open link").slice(0, 60);
			banner.appendChild(link);
		}
		if (dismissible) {
			const dismiss = W.document.createElement("button");
			dismiss.type = "button";
			dismiss.className = "kal-profile-notification-dismiss";
			dismiss.textContent = "×";
			dismiss.title = dismissLabel;
			dismiss.setAttribute("aria-label", dismiss.title);
			dismiss.addEventListener("click", () => {
				onDismiss?.();
				banner.remove();
			});
			banner.appendChild(dismiss);
		}
		return banner;
	}
	function showMandatoryScriptUpgrade(response) {
		if (response.status !== 426) return false;
		if (mandatoryScriptUpgrade) return true;
		const body = objectRecord(response.data) ? response.data : null;
		const details = body && objectRecord(body.details) ? body.details : null;
		const latest = details && typeof details.latest === "string" && details.latest.trim() ? details.latest.trim() : null;
		const message = body && typeof body.error === "string" && body.error.trim() ? body.error.trim() : "This version of KAL Loadout Revealer is no longer supported.";
		const updateUrl = safeHttpsUrl(details?.update_url)?.href || "https://kalends.dev/userscripts/kal-loadout-revealer.user.js";
		mandatoryScriptUpgrade = {
			message: `${message}${latest && latest !== "1.3.3" ? ` Latest: v${latest}.` : ""}`,
			updateUrl,
			updateLabel: `Update to v${latest || "latest"}`
		};
		return true;
	}
	function currentMandatoryScriptUpgrade() {
		return mandatoryScriptUpgrade;
	}
	function withDismissableTooltip(button) {
		const drop = () => {
			if (!button.title) return;
			button.dataset.kalTitle = button.title;
			button.title = "";
		};
		const restore = () => {
			if (!button.title && button.dataset.kalTitle) button.title = button.dataset.kalTitle;
		};
		button.addEventListener("pointerdown", drop);
		button.addEventListener("mouseleave", restore);
		button.addEventListener("blur", restore);
		return button;
	}
	function normalizeResponse(result) {
		if (!result) return null;
		return {
			status: Number(result.status || 0),
			responseText: String(result.responseText || ""),
			responseHeaders: result.responseHeaders ?? null
		};
	}
	function pdaMethod(method) {
		try {
			const candidate = method === "POST" ? PAGE_W.PDA_httpPost : method === "DELETE" ? PAGE_W.PDA_httpDelete : PAGE_W.PDA_httpGet;
			return typeof candidate === "function" ? candidate : null;
		} catch {
			return null;
		}
	}
	async function pdaRequest(request, method) {
		let operation;
		try {
			operation = request.method === "POST" ? Reflect.apply(method, PAGE_W, [
				request.url,
				request.headers,
				request.data || ""
			]) : Reflect.apply(method, PAGE_W, [request.url, request.headers]);
		} catch {
			return null;
		}
		return new Promise((resolve) => {
			let settled = false;
			const finish = (value) => {
				if (settled) return;
				settled = true;
				W.clearTimeout(timer);
				resolve(value);
			};
			const timer = W.setTimeout(() => finish(null), request.timeoutMs);
			try {
				pageThen(operation, (result) => finish(normalizeResponse(result)), () => finish(null), PAGE_W);
			} catch {
				finish(null);
			}
		});
	}
	async function gmRequest(request) {
		if (typeof GM === "undefined" || typeof GM.xmlHttpRequest !== "function") return null;
		return new Promise((resolve) => {
			let settled = false;
			const finish = (value) => {
				if (settled) return;
				settled = true;
				resolve(value);
			};
			try {
				const operation = GM.xmlHttpRequest({
					method: request.method,
					url: request.url,
					headers: request.headers,
					...request.data === void 0 ? {} : { data: request.data },
					timeout: request.timeoutMs,
					onload: (response) => finish(normalizeResponse(response)),
					onerror: () => finish(null),
					ontimeout: () => finish(null),
					onabort: () => finish(null)
				});
				if (operation && typeof operation.then === "function") operation.then((response) => finish(normalizeResponse(response)), () => finish(null));
			} catch {
				finish(null);
			}
		});
	}
	function platformHttpRequest(request) {
		const method = pdaMethod(request.method);
		return method ? pdaRequest(request, method) : gmRequest(request);
	}
	var REQUEST_TIMEOUT_MS = 12e3;
	var authenticationFailureListener = null;
	function onAuthenticationFailure(listener) {
		authenticationFailureListener = listener;
	}
	function notifyAuthenticationFailure() {
		if (!authenticationFailureListener) return;
		runSafely("Could not clear authenticated loadout state", authenticationFailureListener);
	}
	function apiErrorCode(response) {
		const code = response?.data?.code;
		return Number.isSafeInteger(code) && code >= 0 ? Number(code) : null;
	}
	function handleAuthenticationError(response, rejectedCredential = null) {
		if (apiErrorCode(response) !== 2) return false;
		if (rejectAPIKey(rejectedCredential)) notifyAuthenticationFailure();
		return true;
	}
	function apiResponseRetryable(response) {
		return response.status === 0 || response.status === 408 || response.status === 429 || response.status >= 500;
	}
	var mandatoryScriptUpgradeRequired = false;
	function scriptRequestsBlocked() {
		return mandatoryScriptUpgradeRequired;
	}
	function responseMessage(response) {
		const message = response?.data?.error;
		if (response?.status === 429) {
			const retry = Math.ceil(Number(response.retryAfterSeconds));
			if (Number.isFinite(retry) && retry > 0) return `${typeof message === "string" && message ? message : "Too many requests."} Try again in ${retry} seconds.`;
			if (typeof message === "string" && message) return message;
			return "Too many requests. Please try again shortly.";
		}
		if (response?.status >= 500) {
			if (typeof message === "string" && message && message !== "KAL is temporarily unavailable.") return message;
			return "KAL is having trouble loading this right now. Please try again shortly.";
		}
		if (typeof message === "string" && message) return message;
		if (response?.status === 401) return "This API key is not connected to KAL.";
		if (response?.status === 403) return "This API key is not allowed to use this feature.";
		if (response?.status === 408) return "The request timed out. Please try again.";
		return response?.status ? `Request failed (HTTP ${response.status}).` : "KAL could not be reached. Check your connection and try again.";
	}
	function headerValue(headers, name) {
		if (!headers) return null;
		const wanted = name.toLowerCase();
		const pattern = new RegExp(`^${wanted}:[ \t]*([^\r\n]*)`, "im");
		return headers.match(pattern)?.[1]?.trim() || null;
	}
	function retryAfterSeconds(headers) {
		const value = headerValue(headers, "retry-after");
		if (value === null) return null;
		const seconds = Number(value);
		if (Number.isFinite(seconds) && seconds >= 0) return seconds;
		const date = Date.parse(value);
		return Number.isFinite(date) ? Math.max(0, (date - tornNow()) / 1e3) : null;
	}
	function apiUrl(path, query = {}) {
		const url = new URL(`${API_BASE}${path}`);
		for (const [name, value] of Object.entries(query)) {
			if (value === null || value === void 0) continue;
			url.searchParams.set(name, String(value));
		}
		return url.href;
	}
	function apiRequest(method, path, { body = null, query = {} } = {}) {
		const url = apiUrl(path, query);
		const headers = { Accept: "application/json" };
		if (body !== null) headers["Content-Type"] = "application/json";
		const encodedBody = body === null ? null : JSON.stringify(body);
		const wrap = (status, responseText, responseHeaders = null) => ({
			ok: status >= 200 && status < 300,
			status,
			data: parseJson(responseText || ""),
			retryAfterSeconds: retryAfterSeconds(responseHeaders)
		});
		const failure = () => ({
			ok: false,
			status: 0,
			data: null,
			retryAfterSeconds: null
		});
		const finalize = (response) => {
			if (response.status === 426) {
				mandatoryScriptUpgradeRequired = true;
				showMandatoryScriptUpgrade(response);
			}
			return response;
		};
		return platformHttpRequest({
			method,
			url,
			headers,
			...encodedBody === null ? {} : { data: encodedBody },
			timeoutMs: REQUEST_TIMEOUT_MS
		}).then((result) => {
			if (!result) {
				warn("API request failed", null, {
					method,
					path
				});
				return finalize(failure());
			}
			return finalize(wrap(result.status, result.responseText, result.responseHeaders));
		}, (error) => {
			warn("API request failed", error, {
				method,
				path
			});
			return finalize(failure());
		});
	}
	var inFlightClientViews = new Map();
	async function fetchClientView(path) {
		const key = storedAPIKey();
		if (!key) return {
			status: "no-key",
			data: null,
			retryAfterSeconds: null
		};
		if (scriptRequestsBlocked()) return {
			status: "update-required",
			data: null,
			retryAfterSeconds: null,
			message: "Update KAL Loadout Revealer to continue."
		};
		const requestKey = `${key}\n${path}`;
		const existing = inFlightClientViews.get(requestKey);
		if (existing) return existing;
		const request = (async () => {
			const response = await apiRequest("GET", path, { query: {
				key,
				version: SCRIPT_VERSION
			} });
			if (storedAPIKey() !== key) return {
				status: "error",
				data: null,
				retryAfterSeconds: null,
				message: "Request superseded by a credential change.",
				httpStatus: 0,
				errorCode: null,
				retryable: false
			};
			if (response.status === 404) return {
				status: "missing",
				data: null,
				retryAfterSeconds: null
			};
			if (!response.ok) {
				const errorResponse = response;
				const errorCode = apiErrorCode(errorResponse);
				if (response.status === 426) return {
					status: "update-required",
					data: null,
					retryAfterSeconds: null,
					message: "Update KAL Loadout Revealer to continue."
				};
				if (errorCode === 4 || errorCode === 6) return {
					status: "account-unavailable",
					data: null,
					retryAfterSeconds: null,
					message: responseMessage(errorResponse),
					errorCode
				};
				if (handleAuthenticationError(errorResponse, key)) return {
					status: "auth-error",
					data: null,
					retryAfterSeconds: response.retryAfterSeconds
				};
				return {
					status: "error",
					data: null,
					retryAfterSeconds: response.retryAfterSeconds,
					message: responseMessage(errorResponse),
					httpStatus: response.status,
					errorCode,
					retryable: apiResponseRetryable(errorResponse)
				};
			}
			if (!response.data) return {
				status: "error",
				data: null,
				retryAfterSeconds: null,
				message: "KAL returned an empty response. Please try again.",
				httpStatus: response.status,
				errorCode: null,
				retryable: false
			};
			return {
				status: "ok",
				data: response.data,
				retryAfterSeconds: null
			};
		})();
		inFlightClientViews.set(requestKey, request);
		try {
			return await request;
		} finally {
			if (inFlightClientViews.get(requestKey) === request) inFlightClientViews.delete(requestKey);
		}
	}
	function readAttackLoadout(targetId, before = null, includeJobSpecials = false) {
		const query = new URLSearchParams({
			target: String(targetId),
			include_job_specials: String(includeJobSpecials)
		});
		if (before) query.set("before", before);
		return fetchClientView(`/script/attack-loadout?${query}`);
	}
	function readProfileLoadout(targetId, { before = null, includeJobSpecials }) {
		const query = new URLSearchParams({
			target: String(targetId),
			include_job_specials: String(includeJobSpecials)
		});
		if (before) query.set("before", before);
		return fetchClientView(`/script/profile-loadout?${query}`);
	}
	function readProfileLoadoutText(targetId, cursor, includeJobSpecials) {
		return fetchClientView(`/script/profile-loadout/text?${new URLSearchParams({
			target: String(targetId),
			cursor,
			include_job_specials: String(includeJobSpecials)
		})}`);
	}
	function readProfileJobSpecials(targetId) {
		return fetchClientView(`/script/profile-job-specials?${new URLSearchParams({ target: String(targetId) })}`);
	}
	function uploadLoadoutCapture(key, capture) {
		return apiRequest("POST", "/script/upload-loadout", { body: {
			key,
			version: SCRIPT_VERSION,
			...capture
		} });
	}
	var PREFERENCES_SCHEMA = 1;
	var DEFAULT_PREFERENCES = Object.freeze({
		showAttackLoadouts: true,
		showAttackJobSpecials: true,
		showProfileLoadouts: true,
		showProfileJobSpecials: true,
		hideProfileLoadoutOnOwnPage: false,
		keepBonusLabelsVisible: true,
		hideCosmeticsInFights: false,
		profileCollapsed: false
	});
	var preferenceState = { ...DEFAULT_PREFERENCES };
	var preferences = preferenceState;
	var persistenceAllowed = true;
	function booleanOr(value, fallback) {
		return typeof value === "boolean" ? value : fallback;
	}
	function jsonRecord(raw) {
		if (typeof raw !== "string") return null;
		const decoded = parseJson(raw);
		return objectRecord(decoded) ? decoded : null;
	}
	function finalPreferencesRecord(raw) {
		const value = jsonRecord(raw);
		return value && Number(value.schema) === PREFERENCES_SCHEMA ? value : null;
	}
	function decodeFinalPreferences(raw) {
		const value = finalPreferencesRecord(raw);
		if (!value) return null;
		const loadouts = objectRecord(value.loadouts) ? value.loadouts : {};
		const attack = objectRecord(loadouts.attack) ? loadouts.attack : {};
		const profile = objectRecord(loadouts.profile) ? loadouts.profile : {};
		return {
			showAttackLoadouts: booleanOr(attack.enabled, DEFAULT_PREFERENCES.showAttackLoadouts),
			showAttackJobSpecials: booleanOr(attack.showJobSpecials, DEFAULT_PREFERENCES.showAttackJobSpecials),
			showProfileLoadouts: booleanOr(profile.enabled, DEFAULT_PREFERENCES.showProfileLoadouts),
			showProfileJobSpecials: booleanOr(profile.showJobSpecials, DEFAULT_PREFERENCES.showProfileJobSpecials),
			hideProfileLoadoutOnOwnPage: booleanOr(profile.hideOnOwnPage, DEFAULT_PREFERENCES.hideProfileLoadoutOnOwnPage),
			keepBonusLabelsVisible: booleanOr(attack.keepBonusLabelsVisible, DEFAULT_PREFERENCES.keepBonusLabelsVisible),
			hideCosmeticsInFights: booleanOr(attack.hideCosmetics, DEFAULT_PREFERENCES.hideCosmeticsInFights),
			profileCollapsed: booleanOr(profile.collapsed, DEFAULT_PREFERENCES.profileCollapsed)
		};
	}
	function fullPreferencesDocument(state, base = {}) {
		const baseLoadouts = objectRecord(base.loadouts) ? base.loadouts : {};
		const baseAttack = objectRecord(baseLoadouts.attack) ? baseLoadouts.attack : {};
		const baseProfile = objectRecord(baseLoadouts.profile) ? baseLoadouts.profile : {};
		return {
			...base,
			schema: PREFERENCES_SCHEMA,
			loadouts: {
				...baseLoadouts,
				attack: {
					...baseAttack,
					enabled: state.showAttackLoadouts,
					showJobSpecials: state.showAttackJobSpecials,
					keepBonusLabelsVisible: state.keepBonusLabelsVisible,
					hideCosmetics: state.hideCosmeticsInFights
				},
				profile: {
					...baseProfile,
					enabled: state.showProfileLoadouts,
					showJobSpecials: state.showProfileJobSpecials,
					hideOnOwnPage: state.hideProfileLoadoutOnOwnPage,
					collapsed: state.profileCollapsed
				}
			}
		};
	}
	function patchPreferenceDocument(base, key, value) {
		const loadouts = objectRecord(base.loadouts) ? base.loadouts : {};
		if (key === "showAttackLoadouts" || key === "showAttackJobSpecials" || key === "keepBonusLabelsVisible" || key === "hideCosmeticsInFights") {
			const attack = objectRecord(loadouts.attack) ? loadouts.attack : {};
			const field = key === "showAttackLoadouts" ? "enabled" : key === "showAttackJobSpecials" ? "showJobSpecials" : key === "keepBonusLabelsVisible" ? "keepBonusLabelsVisible" : "hideCosmetics";
			return {
				...base,
				schema: PREFERENCES_SCHEMA,
				loadouts: {
					...loadouts,
					attack: {
						...attack,
						[field]: value
					}
				}
			};
		}
		const profile = objectRecord(loadouts.profile) ? loadouts.profile : {};
		const field = key === "showProfileLoadouts" ? "enabled" : key === "showProfileJobSpecials" ? "showJobSpecials" : key === "hideProfileLoadoutOnOwnPage" ? "hideOnOwnPage" : "collapsed";
		return {
			...base,
			schema: PREFERENCES_SCHEMA,
			loadouts: {
				...loadouts,
				profile: {
					...profile,
					[field]: value
				}
			}
		};
	}
	function apply(next) {
		Object.assign(preferenceState, next);
	}
	async function initializePreferences() {
		persistenceAllowed = true;
		let stored;
		try {
			stored = await loadStoredValue(STORAGE_KEYS.preferences, null, true);
		} catch {
			persistenceAllowed = false;
			apply({ ...DEFAULT_PREFERENCES });
			return;
		}
		if (stored !== null && stored !== void 0) {
			const existing = decodeFinalPreferences(stored);
			if (existing) {
				apply(existing);
				return;
			}
			persistenceAllowed = false;
			apply({ ...DEFAULT_PREFERENCES });
			return;
		}
		try {
			const promoted = await promoteFinalGmValue(STORAGE_KEYS.preferences, finalPreferencesRecord, "preference");
			if (promoted.found) {
				persistenceAllowed = promoted.persistenceAllowed;
				apply((promoted.value ? decodeFinalPreferences(JSON.stringify(promoted.value)) : null) ?? { ...DEFAULT_PREFERENCES });
				return;
			}
		} catch {
			persistenceAllowed = false;
			apply({ ...DEFAULT_PREFERENCES });
			return;
		}
		let legacyValues;
		let sourceKeys;
		try {
			({values: legacyValues, sourceKeys} = await readOriginalPreferenceValues());
		} catch {
			persistenceAllowed = false;
			apply({ ...DEFAULT_PREFERENCES });
			return;
		}
		try {
			const racedFinal = await loadStoredValue(STORAGE_KEYS.preferences, null, true);
			if (racedFinal !== null && racedFinal !== void 0) {
				const existing = decodeFinalPreferences(racedFinal);
				if (existing) {
					apply(existing);
					return;
				}
				persistenceAllowed = false;
				apply({ ...DEFAULT_PREFERENCES });
				return;
			}
		} catch {
			persistenceAllowed = false;
			apply({ ...DEFAULT_PREFERENCES });
			return;
		}
		const migrated = {
			showAttackLoadouts: booleanOr(legacyValues.showAttackLoadouts, DEFAULT_PREFERENCES.showAttackLoadouts),
			showAttackJobSpecials: DEFAULT_PREFERENCES.showAttackJobSpecials,
			showProfileLoadouts: booleanOr(legacyValues.showProfileLoadouts, DEFAULT_PREFERENCES.showProfileLoadouts),
			showProfileJobSpecials: booleanOr(legacyValues.showProfileJobSpecials, DEFAULT_PREFERENCES.showProfileJobSpecials),
			hideProfileLoadoutOnOwnPage: booleanOr(legacyValues.hideProfileLoadoutOnOwnPage, DEFAULT_PREFERENCES.hideProfileLoadoutOnOwnPage),
			keepBonusLabelsVisible: booleanOr(legacyValues.keepBonusLabelsVisible, DEFAULT_PREFERENCES.keepBonusLabelsVisible),
			hideCosmeticsInFights: booleanOr(legacyValues.hideCosmeticsInFights, DEFAULT_PREFERENCES.hideCosmeticsInFights),
			profileCollapsed: booleanOr(legacyValues.profileCollapsed, DEFAULT_PREFERENCES.profileCollapsed)
		};
		apply(migrated);
		persistenceAllowed = await persistMigratedValue(STORAGE_KEYS.preferences, JSON.stringify(fullPreferencesDocument(migrated)), finalPreferencesRecord, sourceKeys, "preference");
	}
	function setPreference(key, value) {
		preferenceState[key] = value;
		if (!persistenceAllowed) return;
		updateStoredValue(STORAGE_KEYS.preferences, null, (raw) => {
			const current = finalPreferencesRecord(raw);
			if (!current) throw new Error("Current preference document is not writable by this script version.");
			return JSON.stringify(patchPreferenceDocument(current, key, value));
		}).catch((error) => warn("Could not persist userscript preference", error, { key }));
	}
	var TORN_API_KEYS_URL = "https://www.torn.com/preferences.php#tab=api";
	var API_POLICY_URL = "https://kalends.dev/api-policy";
	var TERMS_URL = "https://kalends.dev/terms";
	var LOADOUTS_URL = "https://kalends.dev/loadouts";
	var FORUM_POST_URL = "https://www.torn.com/forums.php#/p=threads&f=67&t=16597240";
	function errorMessage(error) {
		try {
			if (error && typeof error === "object" && "message" in error) return String(error.message ?? error);
		} catch {
			return "Unknown error";
		}
		return String(error);
	}
	var NOOP = () => {};
	var callbacks = {
		onAttackPreferenceChanged: NOOP,
		onProfilePreferenceChanged: NOOP,
		onAuthConnected: NOOP,
		onAuthRemoved: NOOP
	};
	function initializeSettings(next) {
		callbacks = next;
	}
	var settingsButton = null;
	var settingsPanel = null;
	var settingsOpen = false;
	var settingsOutsideClickInstalled = false;
	var settingsResizeListenerInstalled = false;
	var authenticationOperationInProgress = false;
	function authenticationControls(parent) {
		return [...parent.querySelectorAll(".kal-settings-action")];
	}
	function setAuthenticationOperationInProgress(inProgress, parent = settingsPanel) {
		authenticationOperationInProgress = inProgress;
		if (!parent) return;
		for (const button of authenticationControls(parent)) button.disabled = inProgress;
	}
	function appendToggle(parent, label, checked, onChange) {
		const preference = W.document.createElement("label");
		preference.className = "kal-settings-toggle";
		const checkbox = W.document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.checked = checked;
		checkbox.addEventListener("change", () => onChange(checkbox.checked));
		const text = W.document.createElement("span");
		text.textContent = label;
		preference.append(checkbox, text);
		parent.appendChild(preference);
	}
	function appendSettingsSection(parent, label) {
		const title = W.document.createElement("div");
		title.textContent = label;
		title.className = "kal-settings-section-title";
		parent.appendChild(title);
	}
	function appendDisplayControls(parent) {
		appendSettingsSection(parent, "Attack pages");
		appendToggle(parent, "Show saved loadouts on attack pages", preferences.showAttackLoadouts, (enabled) => {
			setPreference("showAttackLoadouts", enabled);
			callbacks.onAttackPreferenceChanged("showAttackLoadouts");
		});
		appendToggle(parent, "Show combat job specials on attack pages", preferences.showAttackJobSpecials, (enabled) => {
			setPreference("showAttackJobSpecials", enabled);
			callbacks.onAttackPreferenceChanged("showAttackJobSpecials");
		});
		appendToggle(parent, "Show weapon labels during fights", preferences.keepBonusLabelsVisible, (enabled) => {
			setPreference("keepBonusLabelsVisible", enabled);
			callbacks.onAttackPreferenceChanged("keepBonusLabelsVisible");
		});
		appendToggle(parent, "Hide cosmetics during fights", preferences.hideCosmeticsInFights, (enabled) => {
			setPreference("hideCosmeticsInFights", enabled);
			callbacks.onAttackPreferenceChanged("hideCosmeticsInFights");
		});
		appendSettingsSection(parent, "Profile pages");
		appendToggle(parent, "Show saved loadouts on profile pages", preferences.showProfileLoadouts, (enabled) => {
			setPreference("showProfileLoadouts", enabled);
			callbacks.onProfilePreferenceChanged("showProfileLoadouts");
		});
		appendToggle(parent, "Show combat job specials on profiles", preferences.showProfileJobSpecials, (enabled) => {
			setPreference("showProfileJobSpecials", enabled);
			callbacks.onProfilePreferenceChanged("showProfileJobSpecials");
		});
		appendToggle(parent, "Hide on own page", preferences.hideProfileLoadoutOnOwnPage, (enabled) => {
			setPreference("hideProfileLoadoutOnOwnPage", enabled);
			callbacks.onProfilePreferenceChanged("hideProfileLoadoutOnOwnPage");
		});
	}
	function appendConnectedLink(parent) {
		const links = W.document.createElement("div");
		links.className = "kal-settings-links";
		for (const [label, href] of [["Open Website", LOADOUTS_URL], ["Forum Post", FORUM_POST_URL]]) {
			const link = W.document.createElement("a");
			link.href = href;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			link.textContent = label;
			link.className = "kal-settings-link";
			links.appendChild(link);
		}
		parent.appendChild(links);
	}
	function appendPolicyLinks(parent) {
		const links = W.document.createElement("div");
		links.className = "kal-settings-links";
		const policyLinks = [["API Key Usage Policy", API_POLICY_URL], ["Terms of Service", TERMS_URL]];
		for (const [label, href] of policyLinks) {
			const link = W.document.createElement("a");
			link.href = href;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			link.textContent = label;
			link.className = "kal-settings-link";
			links.appendChild(link);
		}
		parent.appendChild(links);
	}
	function setSettingsFeedback(feedback, message, { error = false } = {}) {
		feedback.textContent = message;
		feedback.hidden = false;
		feedback.classList.toggle("is-error", error);
		feedback.setAttribute("role", error ? "alert" : "status");
	}
	function appendMandatoryUpgradeNotice(parent) {
		const upgrade = currentMandatoryScriptUpgrade();
		if (!upgrade) return;
		const notice = W.document.createElement("div");
		notice.className = "kal-settings-feedback is-error";
		notice.setAttribute("role", "alert");
		notice.append(`${upgrade.message} `);
		const url = safeHttpsUrl(upgrade.updateUrl);
		if (url) {
			const link = W.document.createElement("a");
			link.href = url.href;
			link.target = "_blank";
			link.rel = "noopener noreferrer nofollow";
			link.textContent = upgrade.updateLabel;
			notice.appendChild(link);
		}
		parent.appendChild(notice);
	}
	function appendConnectedKeyControls(parent, key) {
		const label = W.document.createElement("label");
		label.textContent = "API Key";
		label.className = "kal-settings-key-label";
		label.htmlFor = "kal-settings-key-input";
		parent.appendChild(label);
		const input = W.document.createElement("input");
		input.id = "kal-settings-key-input";
		input.type = "text";
		input.autocomplete = "off";
		input.spellcheck = false;
		const maskedKey = `${key.slice(0, 4)}${"•".repeat(Math.max(0, key.length - 4))}`;
		input.value = maskedKey;
		input.placeholder = "Enter a public API key";
		input.className = "kal-settings-input";
		input.addEventListener("focus", () => {
			if (input.value === maskedKey) input.value = "";
		});
		parent.appendChild(input);
		const actions = W.document.createElement("div");
		actions.className = "kal-settings-actions";
		const feedback = W.document.createElement("div");
		feedback.className = "kal-settings-feedback";
		feedback.hidden = true;
		feedback.setAttribute("role", "status");
		const save = W.document.createElement("button");
		save.type = "button";
		save.textContent = "Save Key";
		save.className = "kal-settings-action torn-btn btn-save";
		save.disabled = authenticationOperationInProgress;
		save.addEventListener("click", async () => {
			if (authenticationOperationInProgress) return;
			const replacement = input.value.trim();
			if (!replacement) {
				input.setAttribute("aria-invalid", "true");
				setSettingsFeedback(feedback, "Enter a public API key.", { error: true });
				return;
			}
			if (replacement === maskedKey) {
				setSettingsFeedback(feedback, "This API key is already saved.");
				return;
			}
			input.removeAttribute("aria-invalid");
			setAuthenticationOperationInProgress(true, parent);
			save.textContent = "Saving…";
			try {
				await pairAPIKey(replacement);
				setAuthenticationOperationInProgress(false);
				await renderSettingsPanel();
			} catch (error) {
				input.setAttribute("aria-invalid", "true");
				setSettingsFeedback(feedback, errorMessage(error), { error: true });
				setAuthenticationOperationInProgress(false, parent);
				save.textContent = "Save Key";
			}
		});
		const remove = W.document.createElement("button");
		remove.type = "button";
		remove.textContent = "Disconnect Key";
		remove.className = "kal-settings-action torn-btn btn-secondary";
		remove.disabled = authenticationOperationInProgress;
		remove.addEventListener("click", async () => {
			if (authenticationOperationInProgress) return;
			setAuthenticationOperationInProgress(true, parent);
			remove.textContent = "Disconnecting…";
			try {
				const storageCleared = await removeAPIKey();
				setAuthenticationOperationInProgress(false);
				await renderSettingsPanel();
				if (!storageCleared && settingsPanel) {
					const nextFeedback = settingsPanel.querySelector(".kal-settings-feedback");
					if (nextFeedback) setSettingsFeedback(nextFeedback, "Disconnected from KAL, but userscript storage could not remove the saved key. It may reappear after reload.", { error: true });
				}
			} catch (error) {
				setSettingsFeedback(feedback, errorMessage(error), { error: true });
				setAuthenticationOperationInProgress(false, parent);
				remove.textContent = "Disconnect Key";
			}
		});
		actions.append(save, remove);
		parent.appendChild(actions);
		parent.appendChild(feedback);
	}
	async function pairAPIKey(key) {
		const response = await apiRequest("POST", "/script/register", { body: {
			key,
			version: SCRIPT_VERSION,
			agree_to_api_policy_and_tos: true
		} });
		if (!response.ok) throw new Error(responseMessage(response));
		if (!response.data) throw new Error("KAL returned an empty registration response.");
		await saveAPIKey(key);
		try {
			await saveConnectedTornId(response.data.torn_id);
		} catch (error) {
			warn("Could not persist connected Torn ID", error);
		}
		callbacks.onAuthConnected();
	}
	async function removeAPIKey() {
		const key = storedAPIKey();
		if (!key) return true;
		const response = await apiRequest("DELETE", "/script/register", { query: { key } });
		if (!response.ok && response.status !== 401) throw new Error(responseMessage(response));
		if (storedAPIKey() !== key) return true;
		const storageCleared = await forgetAPIKey(key);
		callbacks.onAuthRemoved();
		return storageCleared;
	}
	async function renderSettingsPanel() {
		if (!settingsPanel) return;
		settingsPanel.replaceChildren();
		const heading = W.document.createElement("div");
		heading.textContent = "KAL Loadout Settings";
		heading.className = "kal-settings-heading";
		settingsPanel.appendChild(heading);
		appendMandatoryUpgradeNotice(settingsPanel);
		const key = storedAPIKey();
		if (key) {
			appendConnectedKeyControls(settingsPanel, key);
			appendDisplayControls(settingsPanel);
			appendConnectedLink(settingsPanel);
			positionSettingsPanel();
			return;
		}
		const intro = W.document.createElement("div");
		intro.textContent = "Review the policy below before saving a public API key.";
		intro.className = "kal-settings-intro";
		settingsPanel.appendChild(intro);
		appendPolicyLinks(settingsPanel);
		const keyLinkRow = W.document.createElement("div");
		keyLinkRow.className = "kal-settings-links";
		const keyLink = W.document.createElement("a");
		keyLink.href = TORN_API_KEYS_URL;
		keyLink.target = "_blank";
		keyLink.rel = "noopener noreferrer";
		keyLink.textContent = "Get or create a Torn API key";
		keyLink.className = "kal-settings-link";
		keyLinkRow.appendChild(keyLink);
		settingsPanel.appendChild(keyLinkRow);
		const label = W.document.createElement("label");
		label.textContent = "API Key";
		label.className = "kal-settings-key-label";
		label.htmlFor = "kal-settings-key-input";
		settingsPanel.appendChild(label);
		const input = W.document.createElement("input");
		input.id = "kal-settings-key-input";
		input.type = "text";
		input.name = "kal-api-key";
		input.autocomplete = "off";
		input.spellcheck = false;
		input.autocapitalize = "off";
		input.placeholder = "Enter a public API key";
		input.className = "kal-settings-input";
		settingsPanel.appendChild(input);
		const actions = W.document.createElement("div");
		actions.className = "kal-settings-actions";
		const feedback = W.document.createElement("div");
		feedback.className = "kal-settings-feedback";
		feedback.hidden = true;
		feedback.setAttribute("role", "status");
		const connect = W.document.createElement("button");
		connect.type = "button";
		const connectLabel = "Accept and connect";
		connect.textContent = connectLabel;
		connect.className = "kal-settings-action torn-btn btn-save";
		connect.disabled = authenticationOperationInProgress;
		connect.addEventListener("click", async () => {
			if (authenticationOperationInProgress) return;
			const submittedKey = input.value.trim();
			if (!submittedKey) {
				input.setAttribute("aria-invalid", "true");
				setSettingsFeedback(feedback, "Enter a public API key.", { error: true });
				return;
			}
			input.removeAttribute("aria-invalid");
			setAuthenticationOperationInProgress(true, settingsPanel);
			connect.textContent = "Connecting…";
			try {
				await pairAPIKey(submittedKey);
				setAuthenticationOperationInProgress(false);
				await renderSettingsPanel();
			} catch (error) {
				input.setAttribute("aria-invalid", "true");
				setSettingsFeedback(feedback, errorMessage(error), { error: true });
				setAuthenticationOperationInProgress(false, settingsPanel);
				connect.textContent = connectLabel;
			}
		});
		actions.appendChild(connect);
		settingsPanel.appendChild(actions);
		settingsPanel.appendChild(feedback);
		positionSettingsPanel();
	}
	function focusFirstSettingsControl() {
		if (!settingsOpen || !settingsPanel?.isConnected) return;
		settingsPanel.querySelector("input:not([disabled]), button:not([disabled]), a[href]")?.focus();
	}
	function setSettingsOpen(open, { focusPanel = false } = {}) {
		settingsOpen = Boolean(open && settingsPanel);
		if (!settingsPanel || !settingsButton) return;
		settingsPanel.hidden = !settingsOpen;
		settingsButton.setAttribute("aria-expanded", String(settingsOpen));
		if (settingsOpen) {
			positionSettingsPanel();
			runSafely("Could not render loadout settings", async () => {
				await renderSettingsPanel();
				if (focusPanel) focusFirstSettingsControl();
			});
		}
	}
	function positionSettingsPanel() {
		if (!settingsPanel || !settingsButton?.isConnected || !settingsOpen) return;
		const viewportWidth = W.visualViewport?.width || W.innerWidth;
		const viewportHeight = W.visualViewport?.height || W.innerHeight;
		const button = settingsButton.getBoundingClientRect();
		const edge = 8;
		const width = Math.max(0, Math.min(360, viewportWidth - 16));
		const left = Math.min(Math.max(edge, button.right - width), Math.max(edge, viewportWidth - width - edge));
		const top = Math.min(Math.max(edge, button.bottom + 4), Math.max(edge, viewportHeight - 160));
		settingsPanel.style.left = `${Math.round(left)}px`;
		settingsPanel.style.top = `${Math.round(top)}px`;
		settingsPanel.style.width = `${Math.round(width)}px`;
		settingsPanel.style.maxHeight = `${Math.max(0, Math.floor(viewportHeight - top - edge))}px`;
	}
	function ensureSettingsPanel() {
		if (settingsPanel?.isConnected) return settingsPanel;
		settingsPanel?.remove();
		settingsPanel = W.document.createElement("div");
		settingsPanel.id = "kal-loadout-settings-panel";
		settingsPanel.setAttribute("role", "dialog");
		settingsPanel.setAttribute("aria-label", "KAL Loadout Settings");
		settingsPanel.hidden = true;
		W.document.body.appendChild(settingsPanel);
		installSettingsGlobalListeners();
		return settingsPanel;
	}
	function installSettingsGlobalListeners() {
		if (!settingsOutsideClickInstalled) {
			settingsOutsideClickInstalled = true;
			W.document.addEventListener("click", (event) => {
				const target = event.target instanceof Node ? event.target : null;
				if (settingsOpen && !settingsButton?.contains(target) && !settingsPanel?.contains(target)) setSettingsOpen(false);
			});
			W.document.addEventListener("keydown", (event) => {
				if (settingsOpen && event.key === "Escape") {
					setSettingsOpen(false);
					settingsButton?.focus();
				}
			});
		}
		if (!settingsResizeListenerInstalled) {
			settingsResizeListenerInstalled = true;
			W.addEventListener("resize", positionSettingsPanel, { passive: true });
			W.visualViewport?.addEventListener("resize", positionSettingsPanel, { passive: true });
		}
	}
	function mountSettingsButton(host, { className, label, title }) {
		if (!W.document.body) return null;
		ensureSettingsPanel();
		const button = W.document.createElement("button");
		button.type = "button";
		button.className = className;
		button.textContent = label;
		if (title) {
			button.title = title;
			button.setAttribute("aria-label", title);
		}
		button.setAttribute("aria-controls", "kal-loadout-settings-panel");
		button.setAttribute("aria-expanded", String(settingsOpen));
		button.addEventListener("click", (event) => {
			event.stopPropagation();
			const opening = !settingsOpen;
			setSettingsOpen(opening, { focusPanel: opening && event.detail === 0 });
		});
		host.appendChild(button);
		settingsButton = button;
		if (settingsOpen) positionSettingsPanel();
		return button;
	}
	function mountProfileSettingsButton(host) {
		const gear = mountSettingsButton(host, {
			className: "kal-profile-history-button kal-profile-settings-button",
			label: "⚙︎",
			title: "KAL Loadout settings"
		});
		if (!gear) return null;
		withDismissableTooltip(gear);
		return gear;
	}
	function attackDataDb(data) {
		return objectRecord(data.DB) ? data.DB : data;
	}
	function attackTargetId(data) {
		const user = attackDataDb(data).defenderUser;
		return positiveInteger(objectRecord(user) ? user.userID : null);
	}
	function attackAttackerId(data) {
		const db = attackDataDb(data);
		const user = db.attackerUser;
		const direct = positiveInteger(objectRecord(user) ? user.userID : null);
		if (direct) return direct;
		if (!Array.isArray(db.currentClips)) return null;
		for (const value of db.currentClips) {
			const id = positiveInteger((objectRecord(value) ? value : null)?.attackerID);
			if (id) return id;
		}
		return null;
	}
	function attackFightId(data) {
		const db = attackDataDb(data);
		const direct = positiveInteger(db.fightID ?? db.fightId);
		if (direct) return direct;
		if (!Array.isArray(db.currentClips)) return null;
		for (const value of db.currentClips) {
			const clip = objectRecord(value) ? value : null;
			const id = positiveInteger(clip?.fightID ?? clip?.fightId);
			if (id) return id;
		}
		return null;
	}
	function attackStatus(data) {
		const value = attackDataDb(data).attackStatus;
		return typeof value === "string" ? value : null;
	}
	var FISTS_ITEM_ID = 999;
	var COMBAT_EQUIP_SLOTS = new Set([
		1,
		2,
		3,
		4,
		5,
		6,
		7,
		8,
		9
	]);
	function hasCompleteDefenderLoadout(defenderItems) {
		if (!objectRecord(defenderItems)) return false;
		const fists = defenderItems[FISTS_ITEM_ID]?.item;
		if (Array.isArray(fists) && fists.some((item) => Number(item?.ID) === FISTS_ITEM_ID)) return true;
		return Object.values(defenderItems).some((container) => {
			const item = container?.item?.[0];
			return objectRecord(item) && COMBAT_EQUIP_SLOTS.has(Number(item.equipSlot)) && positiveInteger(item.armouryID ?? item.armoryID) !== null;
		});
	}
	function compactDefenderItems(defenderItems) {
		if (!objectRecord(defenderItems)) return {};
		const compact = {};
		for (const [key, container] of Object.entries(defenderItems)) {
			if (!objectRecord(container) || !Array.isArray(container.item)) continue;
			if (container.item.some((item) => objectRecord(item) && (Number(item.ID) === FISTS_ITEM_ID || COMBAT_EQUIP_SLOTS.has(Number(item.equipSlot))))) compact[key] = container;
		}
		return compact;
	}
	function latestCurrentClip(currentClips) {
		let clip = {};
		if (Array.isArray(currentClips)) {
			for (let index = currentClips.length - 1; index >= 0; index -= 1) if (objectRecord(currentClips[index])) {
				clip = currentClips[index];
				break;
			}
		}
		return clip;
	}
	function ammoCategory(db, clip, prefix, slot) {
		const type = objectRecord(clip[`defender${prefix}Type`]) ? clip[`defender${prefix}Type`] : {};
		if ((objectRecord(db.defenderAmmoStatus) ? db.defenderAmmoStatus[slot] : null) === "No ammo") return 0;
		if (db.showEnemyItems !== true) return null;
		return positiveInteger(type.ammoCategoryID);
	}
	function extractDefenderAmmo(db, currentClips) {
		const clip = latestCurrentClip(currentClips);
		const result = [ammoCategory(db, clip, "Primary", "1"), ammoCategory(db, clip, "Secondary", "2")];
		return result[0] === null && result[1] === null ? null : result;
	}
	function extractLogId(value) {
		if (typeof value !== "string") return null;
		const normalized = value.toLowerCase();
		return /^[0-9a-f]{32}$/.test(normalized) ? normalized : null;
	}
	function travelState(data, db) {
		const message = [data.startErrorTitle, db.error].find((value) => typeof value === "string" && value.length)?.toLowerCase();
		if (message?.includes("currently traveling")) return "traveling";
		if (message?.includes("another country")) return "abroad";
		return null;
	}
	function buildAttackCapture(data, context) {
		const db = attackDataDb(data);
		if (!hasCompleteDefenderLoadout(db.defenderItems)) return null;
		const targetId = attackTargetId(data);
		if (!targetId || targetId !== context.expectedTargetId) return null;
		const fightId = attackFightId(data);
		const showEnemyItems = db.showEnemyItems === true;
		const defenderItems = compactDefenderItems(db.defenderItems);
		return {
			payload_source: context.payloadSource ?? "native",
			target_id: targetId,
			captured_at: context.capturedAt,
			fight_id: fightId,
			attack_status: attackStatus(data)?.slice(0, 32) ?? null,
			show_enemy_items: showEnemyItems,
			travel_state: travelState(data, db),
			defender_items: defenderItems,
			ammo: extractDefenderAmmo(db, db.currentClips),
			log_id: extractLogId(db.logID),
			master_log: positiveInteger(db.masterLog)
		};
	}
	function formatWeaponBonusValue(name, value) {
		const key = name.toLowerCase().replace(/\s+/g, " ").trim();
		if (key === "irradiate" || key === "smash") return null;
		if (value === null || value === void 0 || value === "") return null;
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return null;
		return `${numeric}${key === "disarm" ? "T" : "%"}`;
	}
	var TEMPORARY_CORE_EFFECTS = {
		222: "1/5th Spd 15–20s",
		226: "1/3rd Spd 120–180s",
		256: "1/3rd Dex 120–180s",
		392: "1/5th Dex 15–20s",
		463: "+500% Str 120s",
		464: "+500% Spd 120s",
		465: "+300% Def 120s",
		814: "+500% Dex 120s",
		1042: "1/5th Dex 15–20s"
	};
	var ATTACK_BONUS_NAMES = new Map([
		["Full", "EOD"],
		["Negative", "Delta"],
		["Poisoned", "Poison"]
	]);
	function itemAt(defenderItems, slot) {
		return defenderItems?.[slot]?.item?.[0] || null;
	}
	function bonusLines(item) {
		return Object.values(item?.currentBonuses || {}).slice(0, 2).map((bonus) => {
			const valueRecord = objectRecord(bonus) ? bonus : {};
			const title = String(valueRecord.title || "Bonus");
			const name = ATTACK_BONUS_NAMES.get(title) || title;
			const formatted = formatWeaponBonusValue(title, valueRecord.value);
			return formatted ? `${name} ${formatted}` : name;
		});
	}
	function visibleAttackDetails(defenderItems) {
		const details = {};
		for (const [slotName, slot] of [
			["primary", 1],
			["secondary", 2],
			["melee", 3],
			["temporary", 5]
		]) {
			const item = itemAt(defenderItems, slot);
			if (!item) continue;
			details[slotName] = [String(item.name || `Item #${item.ID}`)];
			if (slot === 5) {
				const itemId = positiveInteger(item.ID);
				const effect = itemId ? TEMPORARY_CORE_EFFECTS[itemId] : void 0;
				if (effect) details[slotName].push(effect);
			} else details[slotName].push(...bonusLines(item));
		}
		return details;
	}
	function attackRevealDetails(reveal) {
		return visibleAttackDetails(reveal.defender_items);
	}
	var ATTACK_TITLE_SELECTOR = "[class*='topSection'] > [class*='titleContainer']";
	var ATTACK_WEAPON_IDS = {
		primary: ["defender_Primary", "weapon_main"],
		secondary: ["defender_Secondary", "weapon_second"],
		melee: ["defender_Melee", "weapon_melee"],
		temporary: ["defender_Temporary", "weapon_temp"]
	};
	var ATTACK_WEAPON_SELECTOR = Object.values(ATTACK_WEAPON_IDS).flat().map((id) => `#${id}`).join(", ");
	var ATTACK_LAYOUT_READY_SELECTOR = `${ATTACK_TITLE_SELECTOR}, #defender_Primary, #defender_Secondary, #defender_Melee, #attacker_Primary, [class*='playerArea']`;
	var ATTACK_LAYOUT_SELECTOR = `${ATTACK_WEAPON_SELECTOR}, [class*='weaponWrapper'], [class*='labelsContainer'], [class*='linksContainer'], .kal-attack-weapon-details, #kal-loadout-settings`;
	function attackTitleContainer() {
		return W.document.querySelector(ATTACK_TITLE_SELECTOR);
	}
	function attackHeaderPlacement() {
		const top = attackTitleContainer()?.parentElement;
		const header = top?.parentElement;
		if (!(top instanceof HTMLElement) || !(header instanceof HTMLElement)) return null;
		return {
			header,
			top,
			divider: header.querySelector(":scope > hr[class*='delimiter']")
		};
	}
	function visibleWeaponOwner(wrapper) {
		if (!wrapper) return null;
		const identity = [
			wrapper.getAttribute("aria-describedby") || "",
			wrapper.getAttribute("aria-labelledby") || "",
			...[...wrapper.querySelectorAll("[id]")].slice(0, 12).map((element) => element.id)
		].join(" ").toLowerCase();
		if (identity.includes("defender")) return "defender";
		if (identity.includes("attacker")) return "attacker";
		return null;
	}
	function attackWeaponWrapper(slotName) {
		for (const id of ATTACK_WEAPON_IDS[slotName] || []) {
			const marker = W.document.getElementById(id);
			if (!marker) continue;
			const wrapper = marker.matches("[class*='weaponWrapper']") ? marker : marker.closest("[class*='weaponWrapper']");
			if (id.startsWith("weapon_") && visibleWeaponOwner(wrapper) !== "defender") continue;
			if (wrapper instanceof HTMLElement) return wrapper;
		}
		return null;
	}
	function attackLayoutChanged(record) {
		if (record.type === "attributes") {
			const target = record.target instanceof Element ? record.target : null;
			return target !== null && Boolean(target.id.startsWith("weapon_") || target.closest("[class*='weaponWrapper'], [class*='labelsContainer']"));
		}
		if ((record.target instanceof Element ? record.target : null)?.matches("[class*='labelsContainer']")) return true;
		return [...record.addedNodes, ...record.removedNodes].some((node) => node instanceof Element && (node.matches(ATTACK_LAYOUT_SELECTOR) || Boolean(node.querySelector(ATTACK_LAYOUT_SELECTOR))));
	}
	function attackLayoutRoot() {
		return W.document.querySelector(".content-wrapper") || W.document.body || W.document.documentElement;
	}
	var captureId = async (data, c) => {
		const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([
			1,
			c.target_id,
			Date.parse(c.captured_at),
			c.fight_id || 0,
			c.payload_source || "",
			c.travel_state || "",
			c.show_enemy_items ? 1 : 0,
			c.defender_items
		])));
		const bytes = new Uint8Array(digest, 0, 16);
		const view = new DataView(bytes.buffer);
		view.setUint32(0, (view.getUint32(0) ^ (attackAttackerId(data) || 0)) >>> 0);
		return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("").replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-");
	};
	var COSMETIC_EQUIP_SLOT = 10;
	var DEFENDER_CLIP_FIELDS = new Set([
		"defenderPrimaryRoundsType",
		"defenderSecondaryRoundsType",
		"defenderPrimaryAmmoType",
		"defenderSecondaryAmmoType",
		"defenderPrimaryType",
		"defenderSecondaryType"
	]);
	var DEFENDER_AMMO_FIELDS = [
		"defenderPrimaryRoundsLeft",
		"defenderPrimaryRoundsType",
		"defenderPrimaryReloads",
		"defenderPrimaryAmmoType",
		"defenderPrimaryType",
		"defenderSecondaryRoundsLeft",
		"defenderSecondaryRoundsType",
		"defenderSecondaryReloads",
		"defenderSecondaryAmmoType",
		"defenderSecondaryType"
	];
	var FISTS_CONTAINER = {
		name: "Fists",
		dmg: "0.00",
		acc: 50,
		ID: 999
	};
	var KICK_CONTAINER = {
		name: "Kick",
		dmg: "0.00",
		acc: 40,
		ID: 1e3
	};
	function normalizeDefenderClip(value) {
		if (!objectRecord(value)) return {};
		const clip = {};
		for (const key of DEFENDER_CLIP_FIELDS) {
			if (!(key in value)) continue;
			const rawValue = value[key];
			if (key.endsWith("Type") && !key.endsWith("AmmoType") && !key.endsWith("RoundsType")) {
				if (!objectRecord(rawValue)) continue;
				const ammoId = positiveInteger(rawValue.ammoID);
				const categoryId = positiveInteger(rawValue.ammoCategoryID);
				if (!ammoId || !categoryId) continue;
				clip[key] = {
					ammoID: String(ammoId),
					ammoCategoryID: String(categoryId)
				};
			} else if (key.endsWith("RoundsType")) {
				if (typeof rawValue !== "string" || !/^\d+,\d+$/.test(rawValue)) continue;
				clip[key] = rawValue;
			} else {
				if (typeof rawValue !== "string" || rawValue.length > 64) continue;
				clip[key] = rawValue;
			}
		}
		return clip;
	}
	function mergeDefenderClip(currentClips, defenderClip) {
		if (!Array.isArray(currentClips) || !currentClips.length) return currentClips;
		const first = { ...objectRecord(currentClips[0]) ? currentClips[0] : {} };
		for (const field of DEFENDER_AMMO_FIELDS) delete first[field];
		Object.assign(first, normalizeDefenderClip(defenderClip));
		return [first, ...currentClips.slice(1)];
	}
	function normalizeDefenderAmmoStatus(value) {
		if (!objectRecord(value)) return {};
		const status = {};
		for (const slot of ["1", "2"]) {
			const rawValue = value[slot];
			if (typeof rawValue === "string" && (rawValue === "No ammo" || /^\d+\/\d+ \(\d+\)$/.test(rawValue)) && rawValue.length <= 32) status[slot] = rawValue;
		}
		return status;
	}
	function mergeDefenderAmmoStatus(currentStatus, revealStatus) {
		const status = { ...objectRecord(currentStatus) ? currentStatus : {} };
		delete status["1"];
		delete status["2"];
		Object.assign(status, normalizeDefenderAmmoStatus(revealStatus));
		return status;
	}
	function unarmedSlots(nativeItems) {
		const native = objectRecord(nativeItems) ? nativeItems : {};
		const slots = { 999: { item: [{ ...FISTS_CONTAINER }] } };
		if (Object.hasOwn(native, "1000")) slots[1e3] = { item: [{ ...KICK_CONTAINER }] };
		return slots;
	}
	function revealAttackFields(db, reveal) {
		return {
			defenderItems: {
				...reveal.defender_items,
				...unarmedSlots(db.defenderItems)
			},
			currentClips: mergeDefenderClip(db.currentClips, reveal.defender_clip),
			defenderAmmoStatus: mergeDefenderAmmoStatus(db.defenderAmmoStatus, reveal.defender_ammo_status),
			showEnemyItems: true
		};
	}
	function transformSavedAttackData(originalData, { enabled, reveal, targetId, allowNativeOverwrite = false }) {
		if (!enabled || !reveal || !targetId) return {
			data: originalData,
			applied: false
		};
		const db = attackDataDb(originalData);
		if (db.attackStatus !== "notStarted" || hasCompleteDefenderLoadout(db.defenderItems) && !allowNativeOverwrite || attackTargetId(originalData) !== targetId || reveal.target_id !== targetId) return {
			data: originalData,
			applied: false
		};
		const patchedDb = {
			...db,
			...revealAttackFields(db, reveal)
		};
		return {
			data: originalData.DB ? {
				...originalData,
				DB: patchedDb
			} : patchedDb,
			applied: true
		};
	}
	function withoutCosmeticItems(data) {
		const db = attackDataDb(data);
		const items = db.defenderItems;
		if (!objectRecord(items)) return null;
		const kept = {};
		let removed = false;
		for (const [key, container] of Object.entries(items)) {
			if (Number(container?.item?.[0]?.equipSlot) === COSMETIC_EQUIP_SLOT) {
				removed = true;
				continue;
			}
			kept[key] = container;
		}
		if (!removed) return null;
		const uncoveredDb = {
			...db,
			defenderItems: kept
		};
		return data.DB ? {
			...data,
			DB: uncoveredDb
		} : uncoveredDb;
	}
	var REACT_CONTAINER_PREFIX = "__reactContainer$";
	var ATTACK_POLL_DONE_ACTION = "attack/pollDone";
	function unwrapPageValue(value) {
		if (value === null || typeof value !== "object" && typeof value !== "function") return value;
		try {
			const unwrapped = value.wrappedJSObject;
			if (unwrapped !== null && unwrapped !== void 0 && (typeof unwrapped === "object" || typeof unwrapped === "function")) return unwrapped;
		} catch {}
		return value;
	}
	function buildInstantHistoryPayload(nativeDb, currentAttack, reveal) {
		const revealFields = revealAttackFields(nativeDb, reveal);
		return {
			...revealFields,
			defenderAmmoStatus: revealFields.defenderAmmoStatus ?? {},
			error: currentAttack.error
		};
	}
	function attackStateFromUnknown(value) {
		if (!objectRecord(value) || !objectRecord(value.attack)) return null;
		return value.attack;
	}
	function instantHistoryStateAllowsDispatch(state) {
		return state.attackStatus === "notStarted" && state.inProgress !== true && state.currentlyUpdatingArmory !== true && state.isFightFinished !== true;
	}
	function readAttackReduxState(store) {
		try {
			const pageStore = unwrapPageValue(store);
			return attackStateFromUnknown(unwrapPageValue(Reflect.apply(pageStore.getState, pageStore, [])));
		} catch {
			return null;
		}
	}
	function isAttackReduxStore(value) {
		if (!objectRecord(value)) return false;
		if (typeof value.dispatch !== "function" || typeof value.getState !== "function") return false;
		return readAttackReduxState(value) !== null;
	}
	function storeFromHostRoot(value) {
		const fiber = unwrapPageValue(value);
		if (!objectRecord(fiber)) return null;
		const state = unwrapPageValue(fiber.memoizedState);
		if (!objectRecord(state)) return null;
		const element = unwrapPageValue(state.element);
		if (!objectRecord(element)) return null;
		const props = unwrapPageValue(element.props);
		if (!objectRecord(props)) return null;
		const store = unwrapPageValue(props.store);
		return isAttackReduxStore(store) ? store : null;
	}
	function findAttackReduxStore(root) {
		if (root === void 0) try {
			root = PAGE_W.document.getElementById("attack-root");
		} catch {
			return null;
		}
		if (!root) return null;
		const pageRoot = unwrapPageValue(root);
		const reactKey = Reflect.ownKeys(pageRoot).find((key) => typeof key === "string" && key.startsWith(REACT_CONTAINER_PREFIX));
		if (!reactKey) return null;
		const attached = unwrapPageValue(pageRoot[reactKey]);
		if (!objectRecord(attached)) return null;
		const stateNode = unwrapPageValue(attached.stateNode);
		const currentCandidate = objectRecord(stateNode) ? unwrapPageValue(stateNode.current) : null;
		return storeFromHostRoot(objectRecord(currentCandidate) ? currentCandidate : attached);
	}
	function dispatchAttackPollDone(store, payload) {
		const pageAction = pageJsonClone({
			type: ATTACK_POLL_DONE_ACTION,
			payload
		});
		const pageStore = unwrapPageValue(store);
		Reflect.apply(pageStore.dispatch, pageStore, [pageAction]);
	}
	var BRIDGE_ID = "kal-loadout-isolated-page-bridge";
	var EVENT_DECIDE = "kal-loadout:rewrite-decision";
	var EVENT_REWRITE = "kal-loadout:rewrite";
	var EVENT_OBSERVE = "kal-loadout:observe";
	var EVENT_COMMIT = "kal-loadout:rewrite-committed";
	var ATTR_DECISION = "data-kal-rewrite-decision";
	var ATTR_OBSERVE_DECISION = "data-kal-observe-decision";
	var ATTR_FOCUSED = "data-kal-focused";
	var ATTR_RECEIVED_AT = "data-kal-received-at";
	var ATTR_REWRITTEN = "data-kal-rewritten";
	var ATTR_RESULT = "data-kal-rewrite-result";
	var ATTR_INSTALLED = "data-kal-page-interceptor-installed";
	var ATTR_CONTENT_INSTALLED = "data-kal-content-interceptor-installed";
	function isolatedPageBootstrap(config) {
		const bridge = document.getElementById(config.bridgeId);
		if (!bridge || bridge.getAttribute(config.installedAttr) === "1") return;
		const currentFetch = window.fetch;
		if (typeof currentFetch !== "function") return;
		const bodyDependentHeaders = new Set([
			"content-length",
			"content-encoding",
			"content-md5",
			"digest",
			"content-digest",
			"repr-digest",
			"etag"
		]);
		const attackDataRequest = (input) => {
			let rawUrl;
			try {
				if (typeof input === "string") rawUrl = input;
				else {
					const foreign = input;
					rawUrl = typeof foreign?.url === "string" ? foreign.url : foreign?.href;
				}
			} catch {
				return false;
			}
			if (typeof rawUrl !== "string" || !rawUrl.includes("sid=attackData")) return false;
			try {
				const url = new URL(rawUrl, location.href);
				return url.origin === location.origin && url.pathname === "/page.php" && url.searchParams.get("sid") === "attackData";
			} catch {
				return false;
			}
		};
		const rewrittenResponse = (response) => {
			try {
				return response.url === "" || response.type === "default";
			} catch {
				return true;
			}
		};
		const setContext = (focused, rewritten, receivedAt) => {
			bridge.setAttribute(config.focusedAttr, focused ? "1" : "0");
			bridge.setAttribute(config.rewrittenAttr, rewritten ? "1" : "0");
			if (receivedAt) bridge.setAttribute(config.receivedAtAttr, receivedAt);
		};
		const exchangeText = (eventName, text, focused, rewritten, receivedAt) => {
			setContext(focused, rewritten, receivedAt);
			bridge.textContent = text;
			bridge.dispatchEvent(new Event(eventName));
		};
		const observeLater = (response, focused, rewritten, receivedAt) => {
			let copy;
			try {
				copy = response.clone();
			} catch {
				return;
			}
			setTimeout(() => {
				try {
					copy.text().then((text) => {
						exchangeText(config.observeEvent, text, focused, rewritten, receivedAt);
						bridge.textContent = "";
					}, () => {});
				} catch {}
			}, 0);
		};
		const rebuildResponse = (response, body) => {
			const headers = [];
			response.headers.forEach((value, name) => {
				if (!bodyDependentHeaders.has(name.toLowerCase())) headers.push([name, value]);
			});
			const ResponseConstructor = response.constructor;
			return new ResponseConstructor(body, {
				status: response.status,
				statusText: response.statusText,
				headers
			});
		};
		const loadoutFetch = function loadoutFetch(...args) {
			const result = Reflect.apply(currentFetch, this, args);
			if (!attackDataRequest(args[0])) return result;
			try {
				return result.then((response) => {
					try {
						if (!response.ok) return response;
						const focused = document.hasFocus();
						const rewritten = rewrittenResponse(response);
						setContext(focused, rewritten);
						bridge.removeAttribute(config.decisionAttr);
						bridge.removeAttribute(config.observeDecisionAttr);
						bridge.removeAttribute(config.receivedAtAttr);
						bridge.dispatchEvent(new Event(config.decisionEvent));
						const receivedAt = bridge.getAttribute(config.receivedAtAttr) || new Date().toISOString();
						const shouldRewrite = bridge.getAttribute(config.decisionAttr) === "1";
						const shouldObserve = bridge.getAttribute(config.observeDecisionAttr) === "1";
						if (!shouldRewrite) {
							if (shouldObserve) observeLater(response, focused, rewritten, receivedAt);
							return response;
						}
						let textPromise;
						try {
							textPromise = response.clone().text();
						} catch {
							return response;
						}
						return textPromise.then((text) => {
							try {
								bridge.setAttribute(config.resultAttr, "unchanged");
								exchangeText(config.rewriteEvent, text, focused, rewritten, receivedAt);
								const changed = bridge.getAttribute(config.resultAttr) === "changed";
								const replacement = bridge.textContent || "";
								bridge.textContent = "";
								if (!changed) return response;
								const rebuilt = rebuildResponse(response, replacement);
								bridge.dispatchEvent(new Event(config.commitEvent));
								return rebuilt;
							} catch {
								return response;
							}
						}, () => response);
					} catch {
						return response;
					}
				});
			} catch {
				return result;
			}
		};
		try {
			window.fetch = loadoutFetch;
			if (window.fetch === loadoutFetch) bridge.setAttribute(config.installedAttr, "1");
		} catch {}
	}
	function shouldObserve$1(context, focused) {
		return Boolean(context.onAttackData && (context.shouldObserveAttackData?.(focused) ?? true));
	}
	function dispatchAttackData$1(observation, context) {
		if (!context.onAttackData) return;
		runSafely("Could not inspect Torn attackData", () => context.onAttackData?.(observation));
	}
	function observationFromBridge(bridge, data) {
		return {
			data,
			rewritten: booleanAttribute(bridge, ATTR_REWRITTEN),
			focused: booleanAttribute(bridge, ATTR_FOCUSED),
			receivedAt: bridge.getAttribute(ATTR_RECEIVED_AT) || new Date(tornNow()).toISOString()
		};
	}
	function enqueueAttackDataObservation$1(observation, context) {
		if (!shouldObserve$1(context, observation.focused)) return;
		W.setTimeout(() => dispatchAttackData$1(observation, context), 0);
	}
	function booleanAttribute(element, name) {
		return element.getAttribute(name) === "1";
	}
	function installIsolatedContentBridge(bridge, context) {
		if (bridge.getAttribute(ATTR_CONTENT_INSTALLED) === "1") return;
		bridge.setAttribute(ATTR_CONTENT_INSTALLED, "1");
		let pendingCommit = null;
		bridge.addEventListener(EVENT_DECIDE, () => {
			pendingCommit = null;
			let shouldRewrite = false;
			let shouldObserveResponse = false;
			try {
				shouldRewrite = Boolean(context.rewriteAttackData && (context.shouldRewriteAttackData?.() ?? false));
			} catch (error) {
				warn("Could not inspect attackData rewrite state", error);
			}
			try {
				shouldObserveResponse = shouldObserve$1(context, booleanAttribute(bridge, ATTR_FOCUSED));
			} catch (error) {
				warn("Could not inspect attackData observation state", error);
			}
			bridge.setAttribute(ATTR_RECEIVED_AT, new Date(tornNow()).toISOString());
			bridge.setAttribute(ATTR_DECISION, shouldRewrite ? "1" : "0");
			bridge.setAttribute(ATTR_OBSERVE_DECISION, shouldObserveResponse ? "1" : "0");
		});
		bridge.addEventListener(EVENT_OBSERVE, () => {
			if (!shouldObserve$1(context, booleanAttribute(bridge, ATTR_FOCUSED))) return;
			const data = parseJson(bridge.textContent || "");
			if (!objectRecord(data)) return;
			dispatchAttackData$1(observationFromBridge(bridge, data), context);
		});
		bridge.addEventListener(EVENT_REWRITE, () => {
			const data = parseJson(bridge.textContent || "");
			if (!objectRecord(data)) return;
			enqueueAttackDataObservation$1(observationFromBridge(bridge, data), context);
			const transform = context.rewriteAttackData;
			if (!transform) return;
			try {
				const result = transform(data);
				if (result.data === data) return;
				const serialized = JSON.stringify(result.data);
				if (serialized === void 0) return;
				bridge.textContent = serialized;
				bridge.setAttribute(ATTR_RESULT, "changed");
				pendingCommit = result.onCommitted ?? null;
			} catch (error) {
				warn("Could not patch Torn attackData", error);
			}
		});
		bridge.addEventListener(EVENT_COMMIT, () => {
			const commit = pendingCommit;
			pendingCommit = null;
			if (!commit) return;
			runSafely("Could not commit Torn attackData rewrite state", commit);
		});
	}
	function pageBridgeSource() {
		const config = {
			bridgeId: BRIDGE_ID,
			decisionEvent: EVENT_DECIDE,
			rewriteEvent: EVENT_REWRITE,
			observeEvent: EVENT_OBSERVE,
			commitEvent: EVENT_COMMIT,
			decisionAttr: ATTR_DECISION,
			observeDecisionAttr: ATTR_OBSERVE_DECISION,
			focusedAttr: ATTR_FOCUSED,
			receivedAtAttr: ATTR_RECEIVED_AT,
			rewrittenAttr: ATTR_REWRITTEN,
			resultAttr: ATTR_RESULT,
			installedAttr: ATTR_INSTALLED
		};
		return `(${isolatedPageBootstrap.toString()})(${JSON.stringify(config)});`;
	}
	function findNonce() {
		for (const script of W.document.scripts) try {
			if (typeof script.nonce === "string" && script.nonce.length > 0) return script.nonce;
		} catch {}
		return null;
	}
	function ensureBridgeElement() {
		const existing = W.document.getElementById(BRIDGE_ID);
		if (existing instanceof HTMLElement) return existing;
		const root = W.document.documentElement;
		if (!root) return null;
		const bridge = W.document.createElement("span");
		bridge.id = BRIDGE_ID;
		bridge.hidden = true;
		root.appendChild(bridge);
		return bridge;
	}
	function addedNodesCouldExposeNonce(records) {
		for (const record of records) for (const node of record.addedNodes) {
			if (!(node instanceof Element)) continue;
			const scripts = node instanceof HTMLScriptElement ? [node] : Array.from(node.querySelectorAll("script"));
			for (const script of scripts) try {
				if (script.nonce) return true;
			} catch {}
		}
		return false;
	}
	function tryInstallPageSide(context) {
		const bridge = ensureBridgeElement();
		if (!bridge) return false;
		installIsolatedContentBridge(bridge, context);
		if (bridge.getAttribute(ATTR_INSTALLED) === "1") return true;
		const nonce = findNonce();
		if (!nonce) return false;
		try {
			const script = W.document.createElement("script");
			script.nonce = nonce;
			script.textContent = pageBridgeSource();
			(W.document.head || W.document.documentElement)?.appendChild(script);
			script.remove();
			return bridge.getAttribute(ATTR_INSTALLED) === "1";
		} catch (error) {
			warn("Could not install isolated attackData page bridge", error);
			return false;
		}
	}
	function installIsolatedAttackDataInterceptor(context) {
		if (tryInstallPageSide(context)) return;
		const observer = new MutationObserver((records) => {
			if (!addedNodesCouldExposeNonce(records)) return;
			if (!tryInstallPageSide(context)) return;
			observer.disconnect();
			W.clearTimeout(timeout);
		});
		observer.observe(W.document.documentElement ?? W.document, {
			childList: true,
			subtree: true
		});
		const timeout = W.setTimeout(() => {
			observer.disconnect();
			if (!tryInstallPageSide(context)) warn("Could not reach Torn's page realm; attackData interception is unavailable");
		}, 5e3);
	}
	var BODY_DEPENDENT_RESPONSE_HEADERS = new Set([
		"content-length",
		"content-encoding",
		"content-md5",
		"digest",
		"content-digest",
		"repr-digest",
		"etag"
	]);
	function rebuiltResponseHeaders(response, host) {
		const headers = [];
		response.headers.forEach(pageFunction((value, name) => {
			if (!BODY_DEPENDENT_RESPONSE_HEADERS.has(name.toLowerCase())) headers.push([name, value]);
		}, host));
		return headers;
	}
	function rebuildResponse(response, body, host) {
		const ResponseConstructor = response.constructor;
		return new ResponseConstructor(body, pageObject({
			status: response.status,
			statusText: response.statusText,
			headers: rebuiltResponseHeaders(response, host)
		}, host));
	}
	function rewriteParsedAttackDataResponse(response, data, transform, host = PAGE_W) {
		let result;
		try {
			result = transform(data);
		} catch (error) {
			warn("Could not patch Torn attackData", error);
			return response;
		}
		if (result.data === data) return response;
		try {
			const replacement = rebuildResponse(response, JSON.stringify(result.data), host);
			result.onCommitted?.();
			return replacement;
		} catch (error) {
			warn("Could not rebuild Torn's attackData response", error);
			return response;
		}
	}
	function isRewrittenResponse(response) {
		try {
			return response.url === "" || response.type === "default";
		} catch {
			return true;
		}
	}
	function isAttackDataRequest(input) {
		let rawUrl;
		try {
			if (typeof input === "string") rawUrl = input;
			else {
				const foreign = input;
				rawUrl = typeof foreign?.url === "string" ? foreign.url : foreign?.href;
			}
		} catch {
			return false;
		}
		if (typeof rawUrl !== "string" || !rawUrl.includes("sid=attackData")) return false;
		try {
			const url = new URL(rawUrl, W.location.href);
			return url.origin === W.location.origin && url.pathname === "/page.php" && url.searchParams.get("sid") === "attackData";
		} catch {
			return false;
		}
	}
	function shouldObserve(context, focused) {
		return Boolean(context.onAttackData && (context.shouldObserveAttackData?.(focused) ?? true));
	}
	function dispatchAttackData(observation, context) {
		if (!context.onAttackData) return;
		runSafely("Could not inspect Torn attackData", () => context.onAttackData?.(observation));
	}
	function enqueueAttackDataObservation(observation, context) {
		if (!shouldObserve(context, observation.focused)) return;
		W.setTimeout(() => dispatchAttackData(observation, context), 0);
	}
	function observeResponseLater(response, focused, receivedAt, context, host) {
		if (!shouldObserve(context, focused)) return;
		const rewritten = isRewrittenResponse(response);
		let copy;
		try {
			copy = response.clone();
		} catch (error) {
			warn("Could not clone Torn's attackData response", error);
			return;
		}
		W.setTimeout(() => {
			try {
				pageThen(copy.text(), (text) => {
					const data = parseJson(text);
					if (objectRecord(data)) dispatchAttackData({
						data,
						rewritten,
						focused,
						receivedAt
					}, context);
				}, (error) => warn("Could not read Torn's attackData response", error), host);
			} catch (error) {
				warn("Could not read Torn's attackData response", error);
			}
		}, 0);
	}
	function shouldRewriteResponse(context) {
		try {
			return Boolean(context.rewriteAttackData && (context.shouldRewriteAttackData?.() ?? false));
		} catch (error) {
			warn("Could not inspect attackData rewrite state", error);
			return false;
		}
	}
	function prepareRewrittenResponse(response, focused, receivedAt, context, host) {
		const transform = context.rewriteAttackData;
		if (!transform) return response;
		const rewritten = isRewrittenResponse(response);
		let textPromise;
		try {
			textPromise = response.clone().text();
		} catch (error) {
			warn("Could not read Torn's attackData response", error);
			return response;
		}
		try {
			return pageThen(textPromise, (text) => {
				const data = parseJson(text);
				if (!objectRecord(data)) return response;
				enqueueAttackDataObservation({
					data,
					rewritten,
					focused,
					receivedAt
				}, context);
				return rewriteParsedAttackDataResponse(response, data, transform, host);
			}, () => response, host);
		} catch (error) {
			warn("Could not prepare Torn's attackData response", error);
			return response;
		}
	}
	var installedFetches = new WeakMap();
	function installAttackDataInterceptor(context = {}) {
		const { page = PAGE, host: explicitHost, onAttackData, shouldObserveAttackData, shouldRewriteAttackData, rewriteAttackData } = context;
		if (page.type !== "attack") return;
		if (!explicitHost && !directPageRealmAvailable()) {
			installIsolatedAttackDataInterceptor({
				onAttackData,
				shouldObserveAttackData,
				shouldRewriteAttackData,
				rewriteAttackData
			});
			return;
		}
		const host = explicitHost ?? PAGE_W;
		const currentFetch = host.fetch;
		if (typeof currentFetch !== "function") return;
		if (installedFetches.get(host) === currentFetch) return;
		const originalFetch = currentFetch;
		const responseContext = {
			onAttackData,
			shouldObserveAttackData,
			shouldRewriteAttackData,
			rewriteAttackData
		};
		if (!publishPageFunction(host, "fetch", function loadoutFetch(...args) {
			const result = Reflect.apply(originalFetch, this, args);
			if (!isAttackDataRequest(args[0])) return result;
			try {
				return pageThen(result, (response) => {
					try {
						if (!response.ok) return response;
						const focused = W.document.hasFocus();
						const receivedAt = new Date(tornNow()).toISOString();
						if (shouldRewriteResponse(responseContext)) return prepareRewrittenResponse(response, focused, receivedAt, responseContext, host);
						observeResponseLater(response, focused, receivedAt, responseContext, host);
						return response;
					} catch (error) {
						warn("Could not process Torn attackData response", error);
						return response;
					}
				}, void 0, host);
			} catch (error) {
				warn("Could not prepare Torn attackData", error);
				return result;
			}
		})) {
			warn("Could not install attackData fetch interceptor");
			return;
		}
		installedFetches.set(host, host.fetch);
	}
	var LEGACY_WAR_HELPER_EVENT = "kal:legacy-warhelper-conflict";
	var WAR_HELPER_UPDATE_URL = "https://greasyfork.org/en/scripts/599213-torn-war-helper";
	var LEGACY_WAR_HELPER_KEY = "__WARHELPER_RUNNING";
	var CONFLICT_ATTR = "data-kal-warhelper-conflict";
	function reportLegacyWarHelperConflict(state) {
		const root = W.document.documentElement;
		if (!root) return;
		root.setAttribute(CONFLICT_ATTR, state);
		W.document.dispatchEvent(new Event(LEGACY_WAR_HELPER_EVENT));
	}
	function legacyWarHelperConflict() {
		const value = W.document.documentElement?.getAttribute(CONFLICT_ATTR);
		return value === "blocked" || value === "running" ? value : null;
	}
	function installLegacyWarHelperGuard() {
		if (!directPageRealmAvailable()) return;
		try {
			const descriptor = Object.getOwnPropertyDescriptor(PAGE_W, LEGACY_WAR_HELPER_KEY);
			if (descriptor && "value" in descriptor && descriptor.value === true) {
				reportLegacyWarHelperConflict("running");
				return;
			}
			if (descriptor) return;
			let reported = false;
			const reportBlocked = () => {
				if (reported) return;
				reported = true;
				reportLegacyWarHelperConflict("blocked");
			};
			Object.defineProperty(PAGE_W, LEGACY_WAR_HELPER_KEY, {
				configurable: true,
				get: pageFunction(() => {
					reportBlocked();
					return true;
				}, PAGE_W),
				set: pageFunction(reportBlocked, PAGE_W)
			});
		} catch (error) {
			warn("Could not install the legacy War Helper guard", error);
		}
	}
	var generation = 0;
	var state = "idle";
	var stateMessage = null;
	var specials = [];
	var companyType = null;
	var companyRating = null;
	var line = null;
	var renderSignature = null;
	var savedLoadoutAvailable = false;
	var warHelperCompatibilityWarning = false;
	var compatibilityMountPending = false;
	function current(requestGeneration) {
		return requestGeneration === generation && PAGE.type === "attack" && preferences.showAttackJobSpecials;
	}
	function shouldDisplay() {
		if (warHelperCompatibilityWarning) return PAGE.type === "attack";
		if (PAGE.type !== "attack" || !PAGE.playerId || !preferences.showAttackJobSpecials || !storedAPIKey() || state === "idle") return false;
		return specials.length > 0 || savedLoadoutAvailable;
	}
	function setAttackJobSpecialsLoadoutAvailable(available) {
		savedLoadoutAvailable = available;
	}
	function showAttackWarHelperCompatibilityWarning() {
		warHelperCompatibilityWarning = true;
		syncAttackJobSpecials();
		if (line?.isConnected || compatibilityMountPending) return;
		compatibilityMountPending = true;
		waitForElement(ATTACK_TITLE_SELECTOR).then(() => {
			compatibilityMountPending = false;
			syncAttackJobSpecials();
		});
	}
	function effectText(special) {
		return special.job_point_cost > 0 ? `${special.effect} (${special.job_point_cost} JP)` : special.effect;
	}
	function jobLabelText() {
		const context = [companyType?.trim() || null, Number.isInteger(companyRating) && Number(companyRating) >= 0 ? `${companyRating}★` : null].filter(Boolean).join(" ");
		return context ? `Job (${context}):` : "Job:";
	}
	function currentRenderSignature() {
		return JSON.stringify([
			warHelperCompatibilityWarning,
			state,
			stateMessage,
			companyType,
			companyRating,
			specials.map((special) => [special.effect, special.job_point_cost])
		]);
	}
	function renderLine() {
		const next = line ?? W.document.createElement("div");
		line = next;
		const signature = currentRenderSignature();
		if (renderSignature === signature && next.childElementCount > 0) return next;
		renderSignature = signature;
		next.id = "kal-attack-job-specials";
		next.dataset.state = state;
		next.setAttribute("role", "status");
		next.setAttribute("aria-live", "polite");
		next.replaceChildren();
		const label = W.document.createElement("span");
		label.className = "kal-attack-job-specials-label";
		label.textContent = warHelperCompatibilityWarning ? "KAL:" : jobLabelText();
		next.appendChild(label);
		const content = W.document.createElement("span");
		content.className = "kal-attack-job-specials-content";
		if (warHelperCompatibilityWarning) {
			next.dataset.state = "compatibility";
			content.append("The version of Warhelper you are using is incompatible with KAL, please ");
			const link = W.document.createElement("a");
			link.href = WAR_HELPER_UPDATE_URL;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			link.textContent = "update to the KAL compatability version";
			content.append(link);
			next.appendChild(content);
			return next;
		}
		if (specials.length) for (const [index, special] of specials.entries()) {
			if (index > 0) {
				const separator = W.document.createElement("span");
				separator.className = "kal-attack-job-specials-separator";
				separator.textContent = "•";
				separator.setAttribute("aria-hidden", "true");
				content.appendChild(separator);
			}
			const effect = W.document.createElement("span");
			effect.className = "kal-attack-job-special";
			effect.textContent = effectText(special);
			content.appendChild(effect);
		}
		const transient = W.document.createElement("span");
		transient.className = "kal-attack-job-specials-state";
		if (state === "loading") transient.textContent = "Checking…";
		else if (state === "ready" && specials.length === 0) transient.textContent = "None";
		else if (state === "update-required") transient.textContent = "Update required";
		else if (state === "account-unavailable") transient.textContent = "Account unavailable";
		else if (state === "unavailable") transient.textContent = "Unavailable";
		if (transient.textContent) {
			if (specials.length) transient.classList.add("has-specials");
			content.appendChild(transient);
		}
		next.appendChild(content);
		return next;
	}
	function syncAttackJobSpecials() {
		if (!shouldDisplay()) {
			line?.remove();
			return;
		}
		const placement = attackHeaderPlacement();
		if (!placement) return;
		const next = renderLine();
		if (next.parentElement !== placement.header) placement.header.insertBefore(next, placement.divider ?? placement.top.nextSibling);
	}
	function attackJobSpecialsNeedsRemount() {
		return shouldDisplay() && !line?.isConnected;
	}
	function markUnavailable(requestGeneration) {
		if (!current(requestGeneration)) return;
		state = "unavailable";
		stateMessage = null;
		syncAttackJobSpecials();
	}
	async function refreshAttackJobSpecials(loadoutRead) {
		if (warHelperCompatibilityWarning || EVENT_NPC_ATTACK) return;
		if (PAGE.type !== "attack" || !PAGE.playerId || !preferences.showAttackJobSpecials) return;
		if (!storedAPIKey()) {
			clearAttackJobSpecials();
			return;
		}
		const requestGeneration = generation + 1;
		generation = requestGeneration;
		state = "loading";
		stateMessage = null;
		specials = [];
		companyType = null;
		companyRating = null;
		syncAttackJobSpecials();
		const targetId = PAGE.playerId;
		let result = loadoutRead ? await loadoutRead : await readProfileJobSpecials(targetId);
		if (!current(requestGeneration)) return;
		if (loadoutRead && (result.status === "missing" || result.status === "ok" && result.data.target_id === targetId && !Object.hasOwn(result.data, "job_specials"))) result = await readProfileJobSpecials(targetId);
		if (!current(requestGeneration)) return;
		if (result.status === "error") {
			markUnavailable(requestGeneration);
			return;
		}
		if (result.status !== "ok") {
			if (result.status === "no-key" || result.status === "auth-error") {
				clearAttackJobSpecials();
				return;
			}
			if (result.status === "update-required") {
				state = "update-required";
				stateMessage = result.message;
				syncAttackJobSpecials();
				return;
			}
			if (result.status === "account-unavailable") {
				state = "account-unavailable";
				stateMessage = result.message;
				syncAttackJobSpecials();
				return;
			}
			markUnavailable(requestGeneration);
			return;
		}
		if (result.data.target_id !== targetId || !Array.isArray(result.data.job_specials)) {
			warn("Attack job specials returned an invalid response", null, { playerId: targetId });
			markUnavailable(requestGeneration);
			return;
		}
		companyType = typeof result.data.company_type === "string" ? result.data.company_type : null;
		companyRating = Number.isInteger(result.data.company_rating) ? Number(result.data.company_rating) : null;
		specials = result.data.job_specials;
		state = "ready";
		stateMessage = null;
		syncAttackJobSpecials();
	}
	function clearAttackJobSpecials() {
		generation += 1;
		state = "idle";
		stateMessage = null;
		specials = [];
		companyType = null;
		companyRating = null;
		renderSignature = null;
		line?.remove();
		if (warHelperCompatibilityWarning) syncAttackJobSpecials();
	}
	var REVEAL = {
		generation: 0,
		retryTimer: null,
		lookupStatus: "idle",
		lookupMessage: null,
		selected: null,
		rendered: null,
		history: [],
		historyIndex: 0,
		historyLoading: false,
		historyOverride: false
	};
	var CAPTURE_RETRY_DELAYS_MS = [
		2e3,
		5e3,
		15e3,
		3e4
	];
	var CAPTURE = {
		generation: 0,
		finalizing: false,
		pending: null,
		uploading: false,
		terminal: false,
		failures: 0,
		degraded: false,
		retryTimer: null
	};
	var ATTACK_VIEW = {
		status: null,
		fightStarted: false,
		nativeLoadoutVisible: false,
		nativeDetails: null,
		observer: null,
		observerRoot: null,
		watchdog: null,
		syncFrame: null,
		settingsMounting: false,
		instantHistoryNativeDb: null
	};
	var settingsControl = null;
	function clearDisplayedReveal() {
		REVEAL.rendered = null;
	}
	function invalidateAttackReveal() {
		resetAttackRevealState();
	}
	function discardPendingCapture() {
		CAPTURE.generation += 1;
		CAPTURE.finalizing = false;
		CAPTURE.pending = null;
		CAPTURE.uploading = false;
		CAPTURE.terminal = false;
		CAPTURE.failures = 0;
		CAPTURE.degraded = false;
		if (CAPTURE.retryTimer !== null) W.clearTimeout(CAPTURE.retryTimer);
		CAPTURE.retryTimer = null;
	}
	function jitteredDelay(delay, ratio = .2) {
		const variance = delay * ratio;
		return Math.max(0, Math.round(delay - variance + Math.random() * variance * 2));
	}
	function terminalLookupStatusForHttpStatus(status) {
		return status === 0 || status === 408 ? "connection-failed" : status === 429 ? "rate-limited" : "server-error";
	}
	function attackStatusCopy(status, uploadFailed = false, message = null) {
		if (status === "update-required") return {
			text: "Update required",
			title: "Update KAL Loadout Revealer to continue"
		};
		if (status === "disconnected") return {
			text: "Disconnected",
			title: "KAL is not connected to a Torn API key"
		};
		if (status === "account-unavailable") return {
			text: "Account unavailable",
			title: message || "This KAL account is currently unavailable"
		};
		if (status === "server-error") return {
			text: "Server error",
			title: "KAL's server could not complete the loadout request"
		};
		if (status === "connection-failed") return {
			text: "Connection failed",
			title: "KAL could not be reached"
		};
		if (status === "rate-limited") return {
			text: "Rate limited",
			title: "KAL rate limited this request."
		};
		if (uploadFailed) return {
			text: "Upload failed",
			title: "KAL could not save this captured loadout"
		};
		if (status === "missing") return {
			text: "No data",
			title: "KAL has no saved loadout for this player"
		};
		return null;
	}
	function resetAttackRevealState(status = "idle") {
		REVEAL.generation += 1;
		if (REVEAL.retryTimer !== null) W.clearTimeout(REVEAL.retryTimer);
		REVEAL.retryTimer = null;
		REVEAL.lookupStatus = status;
		REVEAL.lookupMessage = null;
		REVEAL.selected = null;
		REVEAL.history = [];
		REVEAL.historyIndex = 0;
		REVEAL.historyLoading = false;
		REVEAL.historyOverride = false;
		clearDisplayedReveal();
		resetInstantHistoryRenderer();
		syncAttackView();
	}
	function disconnectAttackReveal() {
		resetAttackRevealState("disconnected");
		ATTACK_VIEW.nativeLoadoutVisible = false;
		ATTACK_VIEW.nativeDetails = null;
		clearAttackWeaponDetails();
		stopAttackLayoutObservation({ keepWatchdog: true });
	}
	function isAttackReveal(value, targetId = PAGE.playerId) {
		return objectRecord(value) && positiveInteger(value.target_id) === targetId && (value.history_cursor === null || typeof value.history_cursor === "string") && objectRecord(value.defender_items) && (Object.keys(value.defender_items).length === 0 || hasCompleteDefenderLoadout(value.defender_items));
	}
	function scheduleAttackRevealRetry(generation, retryAfterFromServer = null) {
		if (REVEAL.retryTimer !== null || REVEAL.generation !== generation || !storedAPIKey() || scriptRequestsBlocked()) return;
		const serverDelay = Number(retryAfterFromServer) * 1e3;
		const delay = Number.isFinite(serverDelay) && serverDelay > 0 ? Math.max(serverDelay, jitteredDelay(2e3)) : jitteredDelay(2e3);
		REVEAL.retryTimer = W.setTimeout(() => {
			REVEAL.retryTimer = null;
			if (REVEAL.generation !== generation || !preferences.showAttackLoadouts) return;
			startAttackRevealPrefetch({ allowRetry: false });
		}, delay);
	}
	function startAttackRevealPrefetch({ allowRetry = true } = {}) {
		if (PAGE.type !== "attack" || !PAGE.playerId || EVENT_NPC_ATTACK) return;
		const targetId = PAGE.playerId;
		if (!preferences.showAttackLoadouts) {
			invalidateAttackReveal();
			return;
		}
		if (REVEAL.retryTimer !== null) W.clearTimeout(REVEAL.retryTimer);
		REVEAL.retryTimer = null;
		const generation = REVEAL.generation + 1;
		REVEAL.generation = generation;
		REVEAL.historyLoading = false;
		if (!storedAPIKey()) {
			REVEAL.lookupStatus = "disconnected";
			syncAttackView();
			return;
		}
		if (scriptRequestsBlocked()) {
			REVEAL.lookupStatus = "update-required";
			syncAttackView();
			return;
		}
		REVEAL.lookupStatus = "loading";
		syncAttackView();
		runSafely("Loadout prefetch failed", async () => {
			const read = readAttackLoadout(targetId, null, preferences.showAttackJobSpecials);
			if (preferences.showAttackJobSpecials) runSafely("Could not load attack job specials", () => refreshAttackJobSpecials(read));
			const result = await read;
			if (REVEAL.generation !== generation) return;
			if (result.status !== "ok") {
				REVEAL.lookupMessage = null;
				if (allowRetry && result.status === "error" && result.retryable) {
					REVEAL.lookupStatus = "loading";
					scheduleAttackRevealRetry(generation, result.retryAfterSeconds);
				} else if (result.status === "missing") REVEAL.lookupStatus = "missing";
				else if (result.status === "no-key" || result.status === "auth-error") REVEAL.lookupStatus = "disconnected";
				else if (result.status === "update-required") REVEAL.lookupStatus = "update-required";
				else if (result.status === "account-unavailable") {
					REVEAL.lookupStatus = "account-unavailable";
					REVEAL.lookupMessage = result.message;
				} else if (result.status === "error") REVEAL.lookupStatus = terminalLookupStatusForHttpStatus(result.httpStatus);
				else REVEAL.lookupStatus = "server-error";
				syncAttackView();
				return;
			}
			if (!isAttackReveal(result.data)) {
				warn("Loadout prefetch returned an invalid response", null, { playerId: PAGE.playerId });
				if (allowRetry) {
					REVEAL.lookupStatus = "loading";
					scheduleAttackRevealRetry(generation);
				} else REVEAL.lookupStatus = "server-error";
				syncAttackView();
				return;
			}
			if (REVEAL.retryTimer !== null) W.clearTimeout(REVEAL.retryTimer);
			REVEAL.retryTimer = null;
			REVEAL.lookupStatus = "ready";
			REVEAL.lookupMessage = null;
			const updateDisplayedReveal = savedAttackItemsRendered();
			REVEAL.selected = result.data;
			REVEAL.history = [result.data];
			REVEAL.historyIndex = 0;
			if (updateDisplayedReveal) displayAttackReveal(result.data);
			else syncAttackView();
		});
	}
	async function uploadPendingCapture() {
		if (!CAPTURE.pending || CAPTURE.terminal || CAPTURE.uploading || CAPTURE.retryTimer !== null) return;
		const key = storedAPIKey();
		if (!key || scriptRequestsBlocked()) return;
		const pending = CAPTURE.pending;
		CAPTURE.uploading = true;
		const response = await uploadLoadoutCapture(key, pending);
		if (CAPTURE.pending !== pending) return;
		CAPTURE.uploading = false;
		if (response.ok) {
			CAPTURE.terminal = true;
			CAPTURE.degraded = false;
			syncAttackView();
			W.document.dispatchEvent(new W.Event("kal:loadout-saved"));
			return;
		}
		if (handleAuthenticationError(response, key)) return;
		const errorCode = apiErrorCode(response);
		if (errorCode === 4 || errorCode === 6) {
			CAPTURE.terminal = true;
			CAPTURE.degraded = true;
			REVEAL.lookupStatus = "account-unavailable";
			REVEAL.lookupMessage = responseMessage(response);
			syncAttackView();
			return;
		}
		if (response.status === 426) {
			CAPTURE.terminal = true;
			REVEAL.lookupStatus = "update-required";
			syncAttackView();
			return;
		}
		if (response.status === 422 && response.data?.code === 41) {
			CAPTURE.terminal = true;
			return;
		}
		const retryable = apiResponseRetryable(response);
		if (!retryable) {
			CAPTURE.terminal = true;
			CAPTURE.degraded = true;
			syncAttackView();
		}
		warn("Loadout upload failed", responseMessage(response), {
			playerId: pending.target_id,
			status: response.status
		});
		if (!retryable) return;
		const backoff = CAPTURE_RETRY_DELAYS_MS[Math.min(CAPTURE.failures, CAPTURE_RETRY_DELAYS_MS.length - 1)] ?? CAPTURE_RETRY_DELAYS_MS[CAPTURE_RETRY_DELAYS_MS.length - 1] ?? 3e4;
		CAPTURE.failures += 1;
		if (CAPTURE.failures >= CAPTURE_RETRY_DELAYS_MS.length) {
			CAPTURE.degraded = true;
			syncAttackView();
		}
		const serverDelay = Number(response.retryAfterSeconds) * 1e3;
		const delay = Number.isFinite(serverDelay) && serverDelay > 0 ? Math.max(serverDelay, jitteredDelay(backoff)) : jitteredDelay(backoff);
		CAPTURE.retryTimer = W.setTimeout(() => {
			CAPTURE.retryTimer = null;
			runSafely("Could not retry the loadout upload", uploadPendingCapture);
		}, delay);
	}
	function savedRevealTransform(originalData, { enabled = preferences.showAttackLoadouts, reveal = REVEAL.selected, targetId = PAGE.playerId } = {}) {
		const historyOverride = REVEAL.historyOverride;
		return transformSavedAttackData(originalData, {
			enabled,
			reveal,
			targetId,
			allowNativeOverwrite: historyOverride || false
		});
	}
	function resetInstantHistoryRenderer() {
		ATTACK_VIEW.instantHistoryNativeDb = null;
		REVEAL.historyOverride = false;
	}
	function tryInstantHistoryRender(reveal) {
		const nativeDb = ATTACK_VIEW.instantHistoryNativeDb;
		if (nativeDb?.attackStatus !== "notStarted" || positiveInteger(nativeDb.defenderUser?.userID) !== PAGE.playerId || reveal.target_id !== PAGE.playerId) return false;
		let store;
		try {
			store = findAttackReduxStore();
		} catch (error) {
			warn("Instant history rendering could not inspect Torn's React state", error);
			return false;
		}
		if (!store) return false;
		const currentAttack = readAttackReduxState(store);
		if (!currentAttack) return false;
		if (!instantHistoryStateAllowsDispatch(currentAttack) || positiveInteger(currentAttack.defenderUser?.userID) !== PAGE.playerId) return false;
		const payload = buildInstantHistoryPayload(nativeDb, currentAttack, reveal);
		try {
			dispatchAttackPollDone(store, payload);
			return true;
		} catch (error) {
			warn("Instant history rendering failed; normal polling will continue", error);
			return false;
		}
	}
	function displayAttackReveal(reveal) {
		REVEAL.selected = reveal;
		REVEAL.historyOverride = false;
		syncAttackView();
	}
	function displayAttackHistoryReveal(reveal) {
		REVEAL.selected = reveal;
		REVEAL.historyOverride = true;
		if (tryInstantHistoryRender(reveal)) REVEAL.rendered = reveal;
		syncAttackView();
	}
	async function showOlderAttackLoadout() {
		if (REVEAL.historyLoading) return;
		const cached = REVEAL.history[REVEAL.historyIndex + 1];
		if (cached) {
			REVEAL.historyIndex += 1;
			displayAttackHistoryReveal(cached);
			return;
		}
		const current = REVEAL.history[REVEAL.historyIndex];
		if (!current?.history_cursor || current.has_previous !== true || !PAGE.playerId) return;
		const generation = REVEAL.generation;
		const olderButton = W.document.querySelector("#kal-loadout-history [data-direction='older']");
		if (olderButton) {
			olderButton.title = "Show the previous distinct loadout";
			olderButton.setAttribute("aria-label", olderButton.title);
			delete olderButton.dataset.error;
		}
		REVEAL.historyLoading = true;
		syncAttackView();
		const result = await readAttackLoadout(PAGE.playerId, current.history_cursor, false);
		if (REVEAL.generation !== generation) return;
		REVEAL.historyLoading = false;
		if (result.status === "ok" && isAttackReveal(result.data)) {
			REVEAL.history.push(result.data);
			REVEAL.historyIndex += 1;
			displayAttackHistoryReveal(result.data);
		} else if (result.status === "update-required") {
			REVEAL.lookupStatus = "update-required";
			syncAttackView();
		} else if (result.status === "missing") {
			current.has_previous = false;
			syncAttackView();
		} else {
			syncAttackView();
			if (result.status === "ok") warn("Attack history returned an invalid response", null, { playerId: PAGE.playerId });
			const older = W.document.querySelector("#kal-loadout-history [data-direction='older']");
			if (older) {
				older.title = "Could not load the previous loadout. Try again.";
				older.setAttribute("aria-label", older.title);
				older.dataset.error = "true";
			}
		}
	}
	function showNewerAttackLoadout() {
		if (REVEAL.historyLoading || REVEAL.historyIndex === 0) return;
		REVEAL.historyIndex -= 1;
		const reveal = REVEAL.history[REVEAL.historyIndex];
		if (reveal) displayAttackHistoryReveal(reveal);
	}
	function savedAttackItemsRendered() {
		if (!preferences.showAttackLoadouts || !REVEAL.rendered) return false;
		return !ATTACK_VIEW.nativeLoadoutVisible || REVEAL.historyOverride || false;
	}
	function activeAttackDetails() {
		if (!storedAPIKey()) return null;
		if (REVEAL.rendered && savedAttackItemsRendered()) return attackRevealDetails(REVEAL.rendered);
		if (preferences.keepBonusLabelsVisible && ATTACK_VIEW.nativeDetails) return ATTACK_VIEW.nativeDetails;
		return null;
	}
	function attackObservationDisplaySignature() {
		return JSON.stringify([
			ATTACK_VIEW.status,
			ATTACK_VIEW.fightStarted,
			ATTACK_VIEW.nativeLoadoutVisible,
			ATTACK_VIEW.nativeDetails,
			REVEAL.rendered !== null,
			REVEAL.historyOverride
		]);
	}
	function syncAttackWeaponDetails() {
		const details = activeAttackDetails();
		if (details) renderAttackWeaponDetails(details);
		else clearAttackWeaponDetails();
	}
	function syncAttackView() {
		if (ATTACK_VIEW.syncFrame !== null) return;
		ATTACK_VIEW.syncFrame = W.requestAnimationFrame(reconcileAttackView);
	}
	function syncAttackStamp() {
		const savedItemsRendered = savedAttackItemsRendered();
		const rendered = REVEAL.rendered;
		const preAttack = !ATTACK_VIEW.fightStarted && (ATTACK_VIEW.status === null || ATTACK_VIEW.status === "notStarted");
		const terminalStatusVisible = REVEAL.lookupStatus === "update-required" || REVEAL.lookupStatus === "account-unavailable" || REVEAL.lookupStatus === "disconnected" || CAPTURE.degraded;
		const statusVisible = preferences.showAttackLoadouts && (REVEAL.lookupStatus !== "idle" || CAPTURE.degraded) && preAttack && (terminalStatusVisible || !ATTACK_VIEW.nativeLoadoutVisible || savedItemsRendered || false);
		const checking = !terminalStatusVisible && (REVEAL.historyLoading || REVEAL.lookupStatus === "loading" || REVEAL.lookupStatus === "ready" && REVEAL.selected !== null && !savedItemsRendered);
		let stampText = "";
		let title = "";
		const statusCopy = attackStatusCopy(REVEAL.lookupStatus, CAPTURE.degraded, REVEAL.lookupMessage);
		if (statusCopy) {
			stampText = statusCopy.text;
			title = statusCopy.title;
		} else if (checking) title = "Checking KAL for a saved loadout";
		else if (REVEAL.lookupStatus === "ready" && rendered && savedItemsRendered) {
			stampText = formatCaptureAge(rendered.observed_at, "compact");
			title = `Captured ${new Date(rendered.observed_at).toLocaleString()}`;
		}
		const stampState = CAPTURE.degraded ? "upload-failed" : checking ? "loading" : REVEAL.lookupStatus;
		const stamp = W.document.getElementById("kal-loadout-stamp");
		if (stamp) {
			if (stamp.textContent !== stampText) stamp.textContent = stampText;
			stamp.dataset.compact = stampText;
			stamp.dataset.state = stampState;
			stamp.title = title;
			stamp.setAttribute("aria-label", title);
			stamp.setAttribute("aria-busy", checking ? "true" : "false");
			stamp.hidden = !statusVisible;
		}
		const history = W.document.getElementById("kal-loadout-history");
		if (!history) return;
		history.hidden = !statusVisible;
		const older = history.querySelector("[data-direction='older']");
		const newer = history.querySelector("[data-direction='newer']");
		const current = REVEAL.history[REVEAL.historyIndex];
		const historyReady = REVEAL.lookupStatus === "ready" && REVEAL.rendered === current && Boolean(REVEAL.rendered?.history_cursor) && savedItemsRendered;
		if (older) older.disabled = !historyReady || REVEAL.historyLoading || current?.has_previous !== true;
		if (newer) newer.disabled = !historyReady || REVEAL.historyLoading || REVEAL.historyIndex === 0;
	}
	function placeAttackControlsSlot(slot, title = attackTitleContainer()) {
		if (!title) return false;
		slot.hidden = false;
		if (settingsControl && settingsControl.parentElement !== slot) slot.prepend(settingsControl);
		title.classList.add("kal-loadout-title-row");
		if (slot.parentElement !== title) title.appendChild(slot);
		return true;
	}
	async function mountAttackControls() {
		if (settingsControl?.isConnected) return true;
		if (PAGE.type !== "attack" || !W.document.body) return false;
		let titleContainer = attackTitleContainer();
		if (!titleContainer) {
			await waitForElement(ATTACK_LAYOUT_READY_SELECTOR);
			titleContainer = attackTitleContainer();
		}
		if (settingsControl?.isConnected) return true;
		const control = W.document.createElement("div");
		control.id = "kal-loadout-settings";
		settingsControl = control;
		mountSettingsButton(control, {
			className: "kal-settings-button",
			label: "KAL settings"
		});
		const stamp = W.document.createElement("span");
		stamp.id = "kal-loadout-stamp";
		stamp.hidden = true;
		stamp.setAttribute("role", "status");
		stamp.setAttribute("aria-live", "polite");
		stamp.style.minWidth = "72px";
		stamp.style.justifyContent = "center";
		const history = W.document.createElement("span");
		history.id = "kal-loadout-history";
		history.hidden = true;
		const older = W.document.createElement("button");
		older.type = "button";
		older.dataset.direction = "older";
		older.textContent = "‹";
		older.title = "Show the previous distinct loadout";
		older.setAttribute("aria-label", older.title);
		older.disabled = true;
		older.addEventListener("click", () => {
			runSafely("Could not load the previous attack loadout", showOlderAttackLoadout);
		});
		const newer = W.document.createElement("button");
		newer.type = "button";
		newer.dataset.direction = "newer";
		newer.textContent = "›";
		newer.title = "Show a newer loadout";
		newer.setAttribute("aria-label", newer.title);
		newer.disabled = true;
		newer.addEventListener("click", showNewerAttackLoadout);
		history.append(older, newer);
		control.append(stamp, history);
		let slot = W.document.getElementById("kal-loadout-controls-slot");
		if (!slot) {
			slot = W.document.createElement("div");
			slot.id = "kal-loadout-controls-slot";
		}
		if (titleContainer) {
			slot.appendChild(control);
			placeAttackControlsSlot(slot, titleContainer);
		} else {
			control.classList.add("is-fallback");
			W.document.body.appendChild(control);
			runSafely("Could not move attack controls into Torn's layout", async () => {
				const title = await waitForElement(ATTACK_TITLE_SELECTOR);
				if (!title || !control.isConnected) return;
				control.classList.remove("is-fallback");
				slot.appendChild(control);
				placeAttackControlsSlot(slot, title);
			});
		}
		syncAttackView();
		if (settingsOpen) setSettingsOpen(true);
		return true;
	}
	function reconcileAttackView() {
		ATTACK_VIEW.syncFrame = null;
		const slot = W.document.getElementById("kal-loadout-controls-slot");
		if (slot && settingsControl?.isConnected) placeAttackControlsSlot(slot);
		syncAttackStamp();
		setAttackJobSpecialsLoadoutAvailable(REVEAL.selected !== null);
		syncAttackJobSpecials();
		if (W.document.body && !settingsControl?.isConnected && !ATTACK_VIEW.settingsMounting) {
			ATTACK_VIEW.settingsMounting = true;
			runSafely("Could not mount attack controls", mountAttackControls).finally(() => {
				ATTACK_VIEW.settingsMounting = false;
			});
		}
		if (!storedAPIKey()) {
			clearAttackWeaponDetails();
			stopAttackLayoutObservation({ keepWatchdog: true });
			return;
		}
		if (!attackLayoutObservationNeeded()) {
			clearAttackWeaponDetails();
			stopAttackLayoutObservation({ keepWatchdog: true });
			return;
		}
		syncAttackWeaponDetails();
		observeAttackLayout();
	}
	function clearAttackWeaponDetails() {
		W.document.querySelectorAll(".kal-attack-weapon-details").forEach((label) => {
			label.remove();
		});
		W.document.querySelectorAll(".kal-attack-labelled-weapon").forEach((wrapper) => {
			wrapper.classList.remove("kal-attack-labelled-weapon");
		});
	}
	function renderAttackWeaponDetails(details) {
		if (!PAGE.playerId || !details) return;
		const rows = Object.entries(details).filter(([, lines]) => Array.isArray(lines) && lines.length);
		if (!rows.length) {
			clearAttackWeaponDetails();
			return;
		}
		const mounted = rows.flatMap(([slotName, lines]) => {
			const wrapper = attackWeaponWrapper(slotName);
			return wrapper ? [[wrapper, lines]] : [];
		});
		const active = new Set(mounted.map(([wrapper]) => wrapper));
		W.document.querySelectorAll(".kal-attack-weapon-details").forEach((label) => {
			if (label.parentElement && active.has(label.parentElement)) return;
			label.parentElement?.classList.remove("kal-attack-labelled-weapon");
			label.remove();
		});
		for (const [wrapper, lines] of mounted) {
			wrapper.classList.add("kal-attack-labelled-weapon");
			let label = wrapper.querySelector(".kal-attack-weapon-details");
			if (!label) {
				label = W.document.createElement("div");
				label.className = "kal-attack-weapon-details";
				wrapper.appendChild(label);
			}
			const signature = lines.join("\0");
			if (label.dataset.content !== signature) {
				label.replaceChildren(...lines.map((text, index) => {
					const line = W.document.createElement("span");
					line.className = index === 0 ? "kal-attack-detail-line kal-attack-item-name" : "kal-attack-detail-line";
					line.textContent = text;
					return line;
				}));
				label.dataset.content = signature;
				label.title = lines.join("\n");
			}
		}
	}
	var ATTACK_LAYOUT_WATCHDOG_MS = 1e4;
	function attackLayoutObservationNeeded() {
		return Boolean(storedAPIKey() && (!EVENT_NPC_ATTACK && preferences.showAttackLoadouts && !ATTACK_VIEW.fightStarted || preferences.keepBonusLabelsVisible));
	}
	function startAttackLayoutWatchdog() {
		if (ATTACK_VIEW.watchdog !== null) return;
		ATTACK_VIEW.watchdog = W.setInterval(() => {
			if (attackLayoutObservationNeeded() && !ATTACK_VIEW.observerRoot?.isConnected || !settingsControl?.isConnected || attackJobSpecialsNeedsRemount()) syncAttackView();
		}, ATTACK_LAYOUT_WATCHDOG_MS);
	}
	function stopAttackLayoutObservation({ keepWatchdog = false } = {}) {
		ATTACK_VIEW.observer?.disconnect();
		ATTACK_VIEW.observer = null;
		ATTACK_VIEW.observerRoot = null;
		if (keepWatchdog) {
			startAttackLayoutWatchdog();
			return;
		}
		if (ATTACK_VIEW.watchdog !== null) W.clearInterval(ATTACK_VIEW.watchdog);
		ATTACK_VIEW.watchdog = null;
	}
	function observeAttackLayout() {
		const root = attackLayoutRoot();
		if (!root) return;
		startAttackLayoutWatchdog();
		if (ATTACK_VIEW.observer && ATTACK_VIEW.observerRoot === root && root.isConnected) return;
		ATTACK_VIEW.observer?.disconnect();
		ATTACK_VIEW.observerRoot = root;
		ATTACK_VIEW.observer = new MutationObserver((records) => {
			if (records.some(attackLayoutChanged)) syncAttackView();
		});
		ATTACK_VIEW.observer.observe(root, {
			attributes: true,
			attributeFilter: [
				"aria-describedby",
				"aria-labelledby",
				"id"
			],
			childList: true,
			subtree: true
		});
	}
	function processAttackData(observation) {
		const { data, rewritten, focused, receivedAt } = observation;
		const db = attackDataDb(data);
		const targetId = attackTargetId(data);
		if (!targetId || targetId !== PAGE.playerId) return;
		if (!storedAPIKey()) return;
		const displayBefore = attackObservationDisplaySignature();
		const fightWasStarted = ATTACK_VIEW.fightStarted;
		ATTACK_VIEW.status = attackStatus(data);
		if (ATTACK_VIEW.status && ATTACK_VIEW.status !== "notStarted") {
			ATTACK_VIEW.fightStarted = true;
			if (!fightWasStarted) {
				resetInstantHistoryRenderer();
				clearDisplayedReveal();
			}
		}
		if (!rewritten && !EVENT_NPC_ATTACK && objectRecord(db) && ATTACK_VIEW.status === "notStarted" && !ATTACK_VIEW.fightStarted) ATTACK_VIEW.instantHistoryNativeDb = db;
		ATTACK_VIEW.nativeLoadoutVisible = hasCompleteDefenderLoadout(db.defenderItems);
		ATTACK_VIEW.nativeDetails = EVENT_NPC_ATTACK || ATTACK_VIEW.nativeLoadoutVisible ? visibleAttackDetails(db.defenderItems) : null;
		const capture = EVENT_NPC_ATTACK || !focused || CAPTURE.terminal || CAPTURE.pending || CAPTURE.finalizing ? null : buildObservedCapture(data, rewritten, receivedAt);
		if (capture && true) clearDisplayedReveal();
		if (displayBefore !== attackObservationDisplaySignature()) syncAttackView();
		if (!capture) return;
		const generation = CAPTURE.generation;
		CAPTURE.finalizing = true;
		runSafely("Could not finalize the captured loadout", async () => {
			capture.capture_id = await captureId(data, capture);
			if (CAPTURE.generation !== generation || CAPTURE.terminal || CAPTURE.pending || !storedAPIKey()) return;
			CAPTURE.pending = capture;
			CAPTURE.degraded = false;
			await uploadPendingCapture();
		}).finally(() => {
			if (CAPTURE.generation === generation) CAPTURE.finalizing = false;
		});
	}
	function buildObservedCapture(data, rewritten, receivedAt) {
		return buildAttackCapture(data, {
			expectedTargetId: PAGE.playerId,
			capturedAt: receivedAt,
			payloadSource: rewritten ? "rewritten" : "native"
		});
	}
	function rewriteAttackDataForTorn(data) {
		const reveal = REVEAL.selected;
		const revealResult = savedRevealTransform(data, { reveal });
		let rewritten = revealResult.data;
		if (preferences.hideCosmeticsInFights) {
			const withoutCosmetics = withoutCosmeticItems(rewritten);
			if (withoutCosmetics) rewritten = withoutCosmetics;
		}
		return {
			data: rewritten,
			onCommitted: revealResult.applied && reveal ? () => {
				if (REVEAL.rendered === reveal) return;
				REVEAL.rendered = reveal;
				syncAttackView();
			} : void 0
		};
	}
	function attackResponseNeedsRewrite({ showAttackLoadouts, hasSelectedReveal, fightStarted, hideCosmeticsInFights }) {
		return showAttackLoadouts && hasSelectedReveal && !fightStarted || hideCosmeticsInFights;
	}
	function attackResponseNeedsObservation({ focused, captureTerminal, capturePending, captureFinalizing, showAttackLoadouts, fightStarted, keepBonusLabelsVisible }) {
		return showAttackLoadouts && !fightStarted || keepBonusLabelsVisible || focused && !captureTerminal && !capturePending && !captureFinalizing;
	}
	function installAttackDataListener(runtimeReady = () => true) {
		W.addEventListener("resize", syncAttackView, { passive: true });
		W.visualViewport?.addEventListener("resize", syncAttackView, { passive: true });
		installAttackDataInterceptor({
			onAttackData: (observation) => {
				if (runtimeReady()) processAttackData(observation);
			},
			shouldObserveAttackData: (focused) => runtimeReady() && Boolean(storedAPIKey() && (EVENT_NPC_ATTACK ? preferences.keepBonusLabelsVisible : attackResponseNeedsObservation({
				focused,
				captureTerminal: CAPTURE.terminal,
				capturePending: CAPTURE.pending !== null,
				captureFinalizing: CAPTURE.finalizing,
				showAttackLoadouts: preferences.showAttackLoadouts,
				fightStarted: ATTACK_VIEW.fightStarted,
				keepBonusLabelsVisible: preferences.keepBonusLabelsVisible
			}))),
			shouldRewriteAttackData: () => !EVENT_NPC_ATTACK && runtimeReady() && Boolean(storedAPIKey()) && attackResponseNeedsRewrite({
				showAttackLoadouts: preferences.showAttackLoadouts,
				hasSelectedReveal: REVEAL.selected !== null,
				fightStarted: ATTACK_VIEW.fightStarted,
				hideCosmeticsInFights: preferences.hideCosmeticsInFights
			}),
			rewriteAttackData: rewriteAttackDataForTorn
		});
	}
	var AMMO_DISPLAYS = [
		{
			categoryId: 0,
			code: "NO",
			name: "No ammo",
			isStandard: false,
			isEmpty: true
		},
		{
			categoryId: 1,
			code: "ST",
			name: "Standard",
			isStandard: true,
			isEmpty: false
		},
		{
			categoryId: 2,
			code: "HP",
			name: "Hollow Point",
			color: "var(--attack-ammo-color-hollow-point, #ffd8a8)",
			isStandard: false,
			isEmpty: false
		},
		{
			categoryId: 3,
			code: "PI",
			name: "Piercing",
			color: "var(--attack-ammo-color-piercing, #74c0fc)",
			isStandard: false,
			isEmpty: false
		},
		{
			categoryId: 4,
			code: "TR",
			name: "Tracer",
			color: "var(--attack-ammo-color-tracer, #ffa94d)",
			isStandard: false,
			isEmpty: false
		},
		{
			categoryId: 5,
			code: "IN",
			name: "Incendiary",
			color: "var(--attack-ammo-color-incendiary, #ff6b6b)",
			isStandard: false,
			isEmpty: false
		}
	];
	var AMMO_BY_NAME = new Map(AMMO_DISPLAYS.map((display) => [display.name.toLowerCase(), display]));
	new Map(AMMO_DISPLAYS.map((display) => [display.categoryId, display]));
	function ammoDisplay(ammo) {
		const name = ammo?.trim() || "";
		const display = AMMO_BY_NAME.get(name.toLowerCase());
		return display ? {
			...display,
			name
		} : null;
	}
	var PROFILE_WEAPON_SLOTS = [
		"primary",
		"secondary",
		"melee",
		"temporary"
	];
	var PROFILE_ARMOR_SLOTS = [
		"helmet",
		"body_armor",
		"pants",
		"boots",
		"gloves"
	];
	var BONUS_BAR_COLORS = {
		gray: ["rgba(70,70,70,.8)", "rgba(70,70,70,.45)"],
		yellow: ["rgba(191,191,0,.75)", "rgba(191,191,0,.2)"],
		orange: ["rgba(191,111,0,.75)", "rgba(191,111,0,.2)"],
		red: ["rgba(224,68,94,.9)", "rgba(224,68,94,.22)"]
	};
	function bonusBarBackground(rangeColor, rangePercent) {
		const [fill, base] = BONUS_BAR_COLORS[rangeColor] || BONUS_BAR_COLORS.gray;
		const percent = rangePercent === null || rangePercent === void 0 || rangePercent === "" ? NaN : Math.min(Math.max(Number(rangePercent), 0), 100);
		if (!Number.isFinite(percent)) return `linear-gradient(90deg,${fill},${base})`;
		return `linear-gradient(90deg,${fill} 0%,${fill} ${Math.max(0, percent - .1)}%,${base} ${Math.min(100, percent + .1)}%,${base} 100%)`;
	}
	function profileBonusElements(bonus) {
		const name = bonus.name || "Bonus";
		const formattedValue = formatWeaponBonusValue(name, bonus.value);
		const content = W.document.createElement("span");
		content.className = "kal-profile-bonus-content";
		const iconControl = W.document.createElement("i");
		iconControl.className = `kal-native-tooltip kal-profile-bonus-icon bonus-attachment-${bonus.icon_class}`;
		if (bonus.id !== null && bonus.id !== void 0) iconControl.dataset.bonusid = String(bonus.id);
		const label = W.document.createElement("span");
		label.className = "kal-profile-bonus-label";
		if (!formattedValue) label.textContent = name;
		else label.textContent = `${formattedValue} ${name}`;
		const bar = W.document.createElement("span");
		bar.className = "kal-profile-bonus-bar";
		bar.style.backgroundImage = bonusBarBackground(bonus.range_color, bonus.range_percent);
		bar.setAttribute("aria-hidden", "true");
		content.append(label, bar);
		const tooltipText = bonus.tooltip_text;
		const tooltipHtml = bonus.tooltip_html;
		iconControl.title = tooltipText;
		iconControl.tabIndex = 0;
		iconControl.setAttribute("aria-label", bonus.tooltip_text);
		iconControl.dataset.tooltipHtml = tooltipHtml;
		iconControl.dataset.tooltipText = tooltipText;
		content.title = tooltipText;
		return [iconControl, content];
	}
	function tornTooltipPluginAvailable() {
		try {
			const jq = PAGE_W.jQuery;
			return typeof jq === "function" && typeof jq.fn?.tooltip === "function";
		} catch {
			return false;
		}
	}
	function tornTooltipWidget(icon) {
		if (!tornTooltipPluginAvailable()) return null;
		try {
			const jq = PAGE_W.jQuery;
			const collection = Reflect.apply(jq, PAGE_W, [icon]);
			if (typeof collection?.data !== "function") return null;
			return collection.data("ui-tooltip") ?? collection.data("uiTooltip") ? collection : null;
		} catch {
			return null;
		}
	}
	function destroyTornTooltips(root) {
		for (const icon of root.querySelectorAll(".kal-native-tooltip")) {
			const collection = tornTooltipWidget(icon);
			if (!collection || typeof collection.tooltip !== "function") continue;
			try {
				Reflect.apply(collection.tooltip, collection, ["destroy"]);
			} catch {}
		}
	}
	function initializeTornTooltips(root, attempt = 0) {
		if (!root?.isConnected) return;
		const icons = [...root.querySelectorAll(".kal-native-tooltip[data-tooltip-html]")];
		if (!icons.length) return;
		let initTooltip = null;
		try {
			initTooltip = typeof PAGE_W.initializeTooltip === "function" ? PAGE_W.initializeTooltip : null;
		} catch {
			initTooltip = null;
		}
		if (!initTooltip || !tornTooltipPluginAvailable()) {
			if (attempt < 5) W.setTimeout(() => initializeTornTooltips(root, attempt + 1), 250);
			return;
		}
		for (const icon of icons) icon.title = icon.dataset.tooltipHtml || icon.title;
		try {
			Reflect.apply(initTooltip, PAGE_W, [".kal-native-tooltip[data-tooltip-html]", "white-tooltip"]);
		} catch {}
		for (const icon of icons) if (!tornTooltipWidget(icon)) icon.title = icon.dataset.tooltipText || icon.title;
	}
	function profileStat(label, value, iconClass) {
		const stat = W.document.createElement("span");
		stat.className = "kal-profile-stat";
		const number = value === null || value === "" ? NaN : Number(value);
		const formatted = Number.isFinite(number) ? number.toFixed(2) : "-";
		stat.setAttribute("aria-label", `${label} ${formatted}`);
		stat.title = label;
		const icon = W.document.createElement("i");
		icon.className = iconClass;
		icon.setAttribute("aria-hidden", "true");
		const text = W.document.createElement("span");
		text.className = "kal-profile-stat-value";
		text.textContent = formatted;
		stat.append(icon, text);
		return stat;
	}
	function profileUpgrades(upgrades) {
		if (!upgrades?.length) return null;
		const descriptions = upgrades.map((upgrade) => upgrade.description || upgrade.name).filter(Boolean);
		if (!descriptions.length) return null;
		const container = W.document.createElement("span");
		container.className = "kal-profile-upgrades kal-profile-mods";
		container.title = descriptions.join("\n");
		for (const [index, description] of descriptions.entries()) {
			if (index) container.append(" ");
			const line = W.document.createElement("span");
			line.className = "kal-profile-mod-line";
			line.textContent = description;
			container.appendChild(line);
		}
		return container;
	}
	function profileSubtext(text) {
		if (!text) return null;
		const container = W.document.createElement("span");
		container.className = "kal-profile-upgrades";
		container.textContent = text;
		container.title = text;
		return container;
	}
	function profileLowerSeparator() {
		const separator = W.document.createElement("span");
		separator.className = "kal-profile-lower-separator";
		separator.setAttribute("aria-hidden", "true");
		return separator;
	}
	var STEROIDS = new Set([
		"melatonin",
		"tyrosine",
		"serotonin",
		"epinephrine"
	]);
	function profileGlow(item) {
		if (STEROIDS.has(item.name.toLowerCase())) return "purple";
		const rarity = String(item.rarity).toLowerCase();
		return [
			"yellow",
			"orange",
			"red"
		].includes(rarity) ? rarity : "default";
	}
	function profileAmmo(ammo) {
		const display = ammoDisplay(ammo);
		if (!display) return null;
		const badge = W.document.createElement("span");
		badge.className = "kal-profile-upgrades kal-profile-ammo";
		if (display.isStandard) badge.classList.add("is-standard");
		if (display.isEmpty) badge.classList.add("is-empty");
		badge.textContent = display.code;
		badge.title = display.isEmpty ? "No ammo loaded" : `${display.name} ammunition`;
		if (display.color) badge.style.color = display.color;
		return badge;
	}
	function profileItem(slot, item) {
		const isWeapon = PROFILE_WEAPON_SLOTS.includes(slot);
		const row = W.document.createElement("li");
		row.className = "kal-profile-item";
		row.dataset.kalProfileSlot = slot;
		const imageWrap = W.document.createElement("span");
		imageWrap.className = `item-plate kal-profile-image-wrap glow-${profileGlow(item)}`;
		const image = W.document.createElement("img");
		const imageBase = item.image_base;
		image.className = "torn-item medium";
		image.src = `${imageBase}.png`;
		image.srcset = `${imageBase}.png 1x, ${imageBase}@2x.png 2x, ${imageBase}@3x.png 3x, ${imageBase}@4x.png 4x`;
		image.alt = item.name;
		image.loading = "lazy";
		imageWrap.appendChild(image);
		const details = W.document.createElement("span");
		details.className = "kal-profile-details";
		const nameLine = W.document.createElement("span");
		nameLine.className = "kal-profile-name-line";
		const name = W.document.createElement("span");
		name.className = "kal-profile-item-name";
		name.textContent = item.name;
		nameLine.appendChild(name);
		if (item.bonuses?.length) {
			const separator = W.document.createElement("span");
			separator.className = "kal-profile-name-separator";
			separator.setAttribute("aria-hidden", "true");
			nameLine.appendChild(separator);
			for (const bonus of item.bonuses) nameLine.append(...profileBonusElements(bonus));
		}
		details.appendChild(nameLine);
		const upgrades = profileUpgrades(item.upgrades);
		const temporaryEffect = slot === "temporary" && item.effect ? profileSubtext(item.effect) : null;
		const blockedTemps = profileSubtext(item.blocked_effects_text);
		const stats = W.document.createElement("span");
		stats.className = "kal-profile-stats";
		const lowerLine = W.document.createElement("span");
		lowerLine.className = "kal-profile-lower-line";
		if (isWeapon) {
			if (item.show_weapon_stats) stats.append(profileStat("Damage", item.damage, "bonus-attachment-item-damage-bonus"), profileStat("Accuracy", item.accuracy, "bonus-attachment-item-accuracy-bonus"));
		} else {
			stats.classList.add("kal-profile-armor-stats");
			stats.appendChild(profileStat("Armor", item.armor, "bonus-attachment-item-defence-bonus"));
		}
		if (stats.childElementCount) lowerLine.appendChild(stats);
		if (upgrades) {
			if (stats.childElementCount) lowerLine.appendChild(profileLowerSeparator());
			lowerLine.appendChild(upgrades);
		} else if (temporaryEffect) lowerLine.appendChild(temporaryEffect);
		else if (blockedTemps) lowerLine.appendChild(blockedTemps);
		const ammo = profileAmmo(item.ammo);
		if (ammo) {
			if (lowerLine.childElementCount) lowerLine.appendChild(profileLowerSeparator());
			lowerLine.appendChild(ammo);
		}
		details.appendChild(lowerLine);
		row.append(imageWrap, details);
		return row;
	}
	function profileJobSpecialsRow(specials, { mobile = false, loading = false, unavailable = false, unavailableMessage = null } = {}) {
		const row = W.document.createElement("li");
		row.className = `kal-profile-item kal-profile-job-specials kal-profile-job-count-${specials.length}`;
		if (mobile) row.classList.add("kal-profile-job-mobile");
		row.dataset.kalProfileJobSpecials = mobile ? "mobile" : "desktop";
		const label = W.document.createElement("span");
		label.className = "item-plate kal-profile-image-wrap glow-default kal-profile-job-label";
		label.textContent = "Job";
		const effects = W.document.createElement("span");
		effects.className = "kal-profile-job-effects";
		if (!specials.length) {
			const emptyRow = W.document.createElement("span");
			emptyRow.className = "kal-profile-job-row";
			const empty = W.document.createElement("span");
			empty.className = "kal-profile-job-effect kal-profile-job-empty";
			empty.textContent = unavailable ? `N/A (${unavailableMessage || "Combat job specials unavailable"})` : loading ? "N/A (Loading combat job specials)" : "N/A";
			emptyRow.appendChild(empty);
			effects.appendChild(emptyRow);
		} else {
			const rows = specials.length <= 1 ? [specials] : specials.length === 2 ? specials.map((special) => [special]) : [specials.filter((_, index) => index % 2 === 0), specials.filter((_, index) => index % 2 === 1)];
			for (const rowSpecials of rows) {
				const row = W.document.createElement("span");
				row.className = "kal-profile-job-row";
				for (const special of rowSpecials) {
					const cost = special.job_point_cost > 0 ? ` (${special.job_point_cost} job points)` : "";
					const effect = W.document.createElement("span");
					effect.className = "kal-profile-job-effect";
					const bullet = W.document.createElement("span");
					bullet.className = "kal-profile-job-bullet";
					bullet.textContent = "•";
					const text = W.document.createElement("span");
					text.className = "kal-profile-job-effect-text";
					text.textContent = `${special.effect}${cost}`;
					text.title = text.textContent;
					effect.append(bullet, text);
					row.appendChild(effect);
				}
				effects.appendChild(row);
			}
		}
		row.append(label, effects);
		return row;
	}
	function profileJobPlaceholderRow() {
		const row = W.document.createElement("li");
		row.className = "kal-profile-item kal-profile-placeholder";
		row.dataset.kalProfileJobPlaceholder = "desktop";
		row.setAttribute("aria-hidden", "true");
		return row;
	}
	function profileSection(slots, loadout, extraRow = null, { emptyText = "No equipment recorded.", reserveTrailingPlaceholder = false } = {}) {
		const section = W.document.createElement("section");
		section.className = "kal-profile-section";
		const list = W.document.createElement("ul");
		list.className = "kal-profile-list";
		const hasItems = slots.some((slot) => Boolean(loadout[slot]));
		for (const slot of slots) {
			const item = loadout[slot];
			if (item) list.appendChild(profileItem(slot, item));
			else if (hasItems || extraRow) {
				const placeholder = W.document.createElement("li");
				placeholder.className = "kal-profile-item kal-profile-placeholder";
				placeholder.setAttribute("aria-hidden", "true");
				list.appendChild(placeholder);
			}
		}
		if (extraRow) list.appendChild(extraRow);
		else if (reserveTrailingPlaceholder && hasItems) list.appendChild(profileJobPlaceholderRow());
		if (!hasItems && !extraRow) {
			const empty = W.document.createElement("div");
			empty.className = "kal-profile-empty";
			empty.textContent = emptyText;
			section.appendChild(empty);
			if (reserveTrailingPlaceholder) {
				const anchor = W.document.createElement("span");
				anchor.hidden = true;
				anchor.dataset.kalProfileJobAnchor = "desktop";
				section.appendChild(anchor);
			}
		} else section.appendChild(list);
		return section;
	}
	function createProfilePanelShell({ toggleClass = "", contentClass }) {
		const container = W.document.createElement("section");
		container.id = "kal-profile-loadout";
		container.className = "m-top10";
		const toggle = W.document.createElement("button");
		toggle.type = "button";
		toggle.className = `title-black title-toggle active kal-profile-toggle${toggleClass ? ` ${toggleClass}` : ""}`;
		toggle.setAttribute("aria-controls", "kal-profile-loadout-content");
		const titleElement = W.document.createElement("span");
		titleElement.className = "kal-profile-title";
		const brandPrefix = W.document.createElement("span");
		brandPrefix.className = "kal-profile-title-prefix";
		brandPrefix.textContent = "KAL - ";
		const titleText = W.document.createElement("span");
		titleText.textContent = "Loadout Information";
		titleElement.append(brandPrefix, titleText);
		const caret = W.document.createElement("span");
		caret.className = "kal-profile-caret";
		caret.setAttribute("aria-hidden", "true");
		caret.textContent = "▼";
		toggle.append(titleElement, caret);
		const history = W.document.createElement("span");
		history.className = "kal-profile-history";
		const content = W.document.createElement("div");
		content.id = "kal-profile-loadout-content";
		content.dataset.kalProfileContent = "";
		content.className = contentClass;
		container.append(toggle, history, content);
		return {
			container,
			toggle,
			caret,
			history,
			content
		};
	}
	function syncProfileJobSpecialRows(panel, specials, loading, enabled, unavailable = false, unavailableMessage = null) {
		const hasJobInformation = specials.length > 0 || unavailable || loading && panel.dataset.kalProfileMode !== "no-loadout";
		const showDesktop = enabled && (panel.dataset.kalProfileMode !== "no-loadout" || hasJobInformation);
		const currentRow = panel.querySelector("[data-kal-profile-job-specials=\"desktop\"]");
		const placeholder = panel.querySelector("[data-kal-profile-job-placeholder=\"desktop\"]");
		const anchor = panel.querySelector("[data-kal-profile-job-anchor=\"desktop\"]");
		const jobOnlyList = panel.querySelector("[data-kal-profile-job-only-list]");
		const jobHost = panel.querySelector("[data-kal-profile-job-host=\"desktop\"]");
		if (showDesktop) {
			const nextRow = profileJobSpecialsRow(specials, {
				loading,
				unavailable,
				unavailableMessage
			});
			if (currentRow) currentRow.replaceWith(nextRow);
			else placeholder?.replaceWith(nextRow);
			if (!currentRow && !placeholder && anchor) {
				const list = W.document.createElement("ul");
				list.className = "kal-profile-list kal-profile-job-only-list";
				list.dataset.kalProfileJobOnlyList = "";
				list.appendChild(nextRow);
				anchor.insertAdjacentElement("afterend", list);
			}
			if (jobHost) jobHost.hidden = false;
		} else if (currentRow) {
			if (jobOnlyList) jobOnlyList.remove();
			else currentRow.replaceWith(profileJobPlaceholderRow());
		}
		if (jobHost && !showDesktop) jobHost.hidden = true;
		const mobileSection = panel.querySelector("[data-kal-profile-mobile-job-section]");
		if (!(enabled && hasJobInformation)) {
			mobileSection?.remove();
			return;
		}
		const nextMobile = profileSection([], {}, profileJobSpecialsRow(specials, {
			mobile: true,
			loading,
			unavailable,
			unavailableMessage
		}));
		nextMobile.classList.add("kal-profile-mobile-job-section");
		nextMobile.dataset.kalProfileMobileJobSection = "";
		if (mobileSection) mobileSection.replaceWith(nextMobile);
		else panel.querySelector("[data-kal-profile-content]")?.appendChild(nextMobile);
	}
	function preserveProfileItemImages(existing, next) {
		const existingPlates = new Map();
		for (const row of existing.querySelectorAll("[data-kal-profile-slot]")) {
			const slot = row.dataset.kalProfileSlot;
			const plate = row.querySelector(".kal-profile-image-wrap");
			if (slot && plate) existingPlates.set(slot, plate);
		}
		for (const row of next.querySelectorAll("[data-kal-profile-slot]")) {
			const slot = row.dataset.kalProfileSlot;
			const currentPlate = slot ? existingPlates.get(slot) : null;
			const nextPlate = row.querySelector(".kal-profile-image-wrap");
			if (!currentPlate || !nextPlate) continue;
			const currentImage = currentPlate.querySelector("img");
			const nextImage = nextPlate.querySelector("img");
			if (!currentImage || !nextImage) continue;
			currentPlate.className = nextPlate.className;
			currentImage.className = nextImage.className;
			currentImage.alt = nextImage.alt;
			currentImage.loading = nextImage.loading;
			if (currentImage.getAttribute("src") !== nextImage.getAttribute("src")) {
				const srcset = nextImage.getAttribute("srcset");
				if (srcset) currentImage.setAttribute("srcset", srcset);
				else currentImage.removeAttribute("srcset");
				const src = nextImage.getAttribute("src");
				if (src) currentImage.setAttribute("src", src);
			}
			nextPlate.replaceWith(currentPlate);
		}
	}
	var profileHistory = [];
	var profileHistoryIndex = 0;
	var profileHistoryLoading = false;
	var profileGeneration = 0;
	var profileJobGeneration = 0;
	var profilePrefetch = null;
	var profileJobSpecials = [];
	var profileJobSpecialsState = "idle";
	var profileJobSpecialsUnavailableMessage = null;
	var profilePlacementObserver = null;
	function receiveProfileResponseNotification(value) {
		runSafely("Could not store the notification", () => {
			receiveNotification(value.notification);
		});
	}
	function shouldHideOnOwnProfilePage() {
		return preferences.hideProfileLoadoutOnOwnPage && PAGE.playerId !== null && PAGE.playerId === connectedTornId();
	}
	function warHelperCompatibilityNotice() {
		const notice = renderProfileNotice({
			message: "The version of Warhelper you are using is incompatible with KAL, please update to the KAL compatability version",
			linkUrl: WAR_HELPER_UPDATE_URL,
			linkLabel: "Update War Helper"
		});
		notice.dataset.kalWarHelperConflict = "";
		return notice;
	}
	function appendProfileNotices(parent, latestVersion = null) {
		if (legacyWarHelperConflict()) parent.appendChild(warHelperCompatibilityNotice());
		const mandatoryUpgrade = currentMandatoryScriptUpgrade();
		if (mandatoryUpgrade) {
			const notice = renderProfileNotice({
				message: mandatoryUpgrade.message,
				linkUrl: mandatoryUpgrade.updateUrl,
				linkLabel: mandatoryUpgrade.updateLabel
			});
			notice.dataset.kalMandatoryUpgrade = "";
			parent.appendChild(notice);
		}
		const notification = currentNotification();
		if (notification) parent.appendChild(renderProfileNotice({
			message: notification.message,
			linkUrl: notification.link_url,
			linkLabel: notification.link_label,
			dismissible: true,
			dismissLabel: "Dismiss notification",
			onDismiss: () => dismissNotification(notification.id)
		}));
		if (!mandatoryUpgrade && isNewerScriptVersion(latestVersion)) {
			const version = latestVersion.trim();
			parent.appendChild(renderProfileNotice({
				message: `A new version of this script is available. Latest: v${version}.`,
				linkUrl: SCRIPT_UPDATE_URL,
				linkLabel: `Update to v${version}`
			}));
		}
	}
	function surfaceMandatoryUpgradeOnProfile() {
		const upgrade = currentMandatoryScriptUpgrade();
		if (!upgrade) return;
		const content = W.document.querySelector("#kal-profile-loadout [data-kal-profile-content]");
		if (!content) return;
		if (content.querySelector("[data-kal-mandatory-upgrade]")) return;
		const notice = renderProfileNotice({
			message: upgrade.message,
			linkUrl: upgrade.updateUrl,
			linkLabel: upgrade.updateLabel
		});
		notice.dataset.kalMandatoryUpgrade = "";
		content.prepend(notice);
	}
	function startProfilePrefetch({ fresh = false } = {}) {
		if (PAGE.type !== "profile" || !PAGE.playerId || !preferences.showProfileLoadouts || shouldHideOnOwnProfilePage()) return null;
		const targetId = PAGE.playerId;
		const includeJobSpecials = preferences.showProfileJobSpecials;
		if (!fresh && profilePrefetch?.targetId === targetId && profilePrefetch.includeJobSpecials === includeJobSpecials) return profilePrefetch.request;
		const request = readProfileLoadout(targetId, { includeJobSpecials });
		profilePrefetch = {
			targetId,
			includeJobSpecials,
			request
		};
		return request;
	}
	function isProfileLoadoutText(value, loadout) {
		return value.target_id === loadout.target_id;
	}
	function profileJobLoading() {
		return profileJobSpecialsState === "loading";
	}
	function profileJobUnavailable() {
		return profileJobSpecialsState === "unavailable";
	}
	function currentProfileJobGeneration(pageGeneration, jobGeneration) {
		return currentProfileGeneration(pageGeneration) && preferences.showProfileJobSpecials && jobGeneration === profileJobGeneration;
	}
	function markProfileJobSpecialsUnavailable(pageGeneration, jobGeneration, message = null) {
		if (!currentProfileJobGeneration(pageGeneration, jobGeneration)) return;
		profileJobSpecialsState = "unavailable";
		profileJobSpecialsUnavailableMessage = message;
		syncProfileJobSpecialsPresentation(pageGeneration);
	}
	async function refreshProfileJobSpecials() {
		if (PAGE.type !== "profile" || !preferences.showProfileLoadouts || !preferences.showProfileJobSpecials || !PAGE.playerId || shouldHideOnOwnProfilePage()) return;
		const targetId = PAGE.playerId;
		const pageGeneration = profileGeneration;
		const jobGeneration = profileJobGeneration + 1;
		profileJobGeneration = jobGeneration;
		profileJobSpecialsState = "loading";
		profileJobSpecialsUnavailableMessage = null;
		syncProfileJobSpecialsPresentation(pageGeneration);
		const result = await readProfileJobSpecials(targetId);
		if (!currentProfileJobGeneration(pageGeneration, jobGeneration)) return;
		if (result.status !== "ok") {
			if (result.status === "update-required") surfaceMandatoryUpgradeOnProfile();
			markProfileJobSpecialsUnavailable(pageGeneration, jobGeneration, result.status === "account-unavailable" || result.status === "error" ? result.message : result.status === "auth-error" ? "Reconnect a Torn API key" : result.status === "no-key" ? "Connect a Torn API key" : null);
			return;
		}
		if (result.data.target_id !== targetId) {
			warn("Profile job specials returned the wrong target", null, { playerId: targetId });
			markProfileJobSpecialsUnavailable(pageGeneration, jobGeneration);
			return;
		}
		profileJobSpecials = result.data.job_specials;
		profileJobSpecialsState = "ready";
		profileJobSpecialsUnavailableMessage = null;
		syncProfileJobSpecialsPresentation(pageGeneration);
	}
	function refreshProfilePresentationFromMemory() {
		if (PAGE.type !== "profile" || !preferences.showProfileLoadouts) return;
		if (!PAGE.playerId || shouldHideOnOwnProfilePage()) return;
		if (!preferences.showProfileJobSpecials) {
			profileJobGeneration += 1;
			profileJobSpecialsState = "idle";
			profileJobSpecialsUnavailableMessage = null;
		}
		syncProfileJobSpecialsPresentation(profileGeneration);
	}
	function surfaceProfileWarHelperCompatibilityNotice() {
		if (!legacyWarHelperConflict()) return;
		const content = W.document.querySelector("#kal-profile-loadout [data-kal-profile-content]");
		if (!content || content.querySelector("[data-kal-war-helper-conflict]")) return;
		content.prepend(warHelperCompatibilityNotice());
	}
	async function renderProfileWarHelperCompatibilityWarning() {
		clearProfilePage();
		const generation = profileGeneration;
		const { container, content } = createProfilePanelShell({
			toggleClass: "kal-profile-status-toggle",
			contentClass: "cont bottom-round kal-profile-status is-error"
		});
		container.dataset.kalProfileMode = "compatibility";
		content.setAttribute("role", "alert");
		content.setAttribute("aria-live", "polite");
		content.appendChild(warHelperCompatibilityNotice());
		const mounted = await mountProfilePanel(container, generation);
		if (mounted) enableProfileCollapse(mounted);
	}
	function clearProfilePage() {
		profileGeneration += 1;
		profileJobGeneration += 1;
		profileHistory = [];
		profileHistoryIndex = 0;
		profileHistoryLoading = false;
		profilePrefetch = null;
		profileJobSpecials = [];
		profileJobSpecialsState = "idle";
		profileJobSpecialsUnavailableMessage = null;
		profilePlacementObserver?.disconnect();
		profilePlacementObserver = null;
		const panel = W.document.getElementById("kal-profile-loadout");
		if (panel) {
			destroyTornTooltips(panel);
			panel.remove();
		}
	}
	function currentProfileGeneration(generation) {
		return generation === profileGeneration && preferences.showProfileLoadouts;
	}
	function syncProfileHistoryControls() {
		const current = profileHistory[profileHistoryIndex];
		const history = W.document.querySelector("#kal-profile-loadout .kal-profile-history");
		const older = history?.querySelector("[data-direction='older']");
		const newer = history?.querySelector("[data-direction='newer']");
		if (older) older.disabled = profileHistoryLoading || current?.has_previous !== true;
		if (newer) newer.disabled = profileHistoryLoading || profileHistoryIndex === 0;
	}
	async function renderProfileNoLoadout(generation = profileGeneration) {
		if (!currentProfileGeneration(generation)) return;
		const { container, history, content } = createProfilePanelShell({
			toggleClass: "kal-profile-status-toggle",
			contentClass: "cont bottom-round kal-profile-content kal-profile-content-no-loadout"
		});
		container.dataset.kalProfileMode = "no-loadout";
		mountProfileSettingsButton(history);
		appendProfileNotices(content);
		const status = W.document.createElement("div");
		status.className = "kal-profile-no-loadout-status";
		status.textContent = "No saved loadout for this player.";
		status.setAttribute("role", "status");
		content.appendChild(status);
		const desktopJobHost = W.document.createElement("section");
		desktopJobHost.className = "kal-profile-section kal-profile-no-loadout-job-desktop";
		desktopJobHost.dataset.kalProfileJobHost = "desktop";
		desktopJobHost.hidden = true;
		const desktopJobAnchor = W.document.createElement("span");
		desktopJobAnchor.hidden = true;
		desktopJobAnchor.dataset.kalProfileJobAnchor = "desktop";
		desktopJobHost.appendChild(desktopJobAnchor);
		content.appendChild(desktopJobHost);
		syncProfileJobSpecialRows(container, profileJobSpecials, profileJobLoading(), preferences.showProfileJobSpecials, profileJobUnavailable(), profileJobSpecialsUnavailableMessage);
		const mounted = await mountProfilePanel(container, generation);
		if (mounted && currentProfileGeneration(generation)) enableProfileCollapse(mounted);
	}
	function syncProfileJobSpecialsPresentation(generation = profileGeneration) {
		if (!currentProfileGeneration(generation)) return;
		const panel = W.document.getElementById("kal-profile-loadout");
		if (!panel) return;
		syncProfileJobSpecialRows(panel, profileJobSpecials, profileJobLoading(), preferences.showProfileJobSpecials, profileJobUnavailable(), profileJobSpecialsUnavailableMessage);
	}
	async function copyProfileLoadout(loadout, button) {
		const originalLabel = button.textContent || "Copy";
		button.disabled = true;
		button.textContent = "Copying…";
		try {
			const result = await readProfileLoadoutText(loadout.target_id, loadout.history_cursor ?? "", preferences.showProfileJobSpecials);
			if (result.status === "update-required") {
				surfaceMandatoryUpgradeOnProfile();
				button.textContent = "Update required";
				button.title = "Update KAL to copy this loadout";
				button.disabled = false;
				return;
			}
			if (result.status !== "ok" || !isProfileLoadoutText(result.data, loadout)) throw new Error(result.status === "error" ? result.message : "The server did not return a valid text loadout.");
			const text = result.data.text;
			let copied = false;
			if (W.navigator.clipboard?.writeText) try {
				await W.navigator.clipboard.writeText(text);
				copied = true;
			} catch {}
			if (!copied) {
				const input = W.document.createElement("textarea");
				input.value = text;
				input.style.position = "fixed";
				input.style.opacity = "0";
				W.document.body.appendChild(input);
				input.select();
				copied = W.document.execCommand("copy");
				input.remove();
				if (!copied) throw new Error("The browser refused the clipboard operation.");
			}
			button.textContent = "Copied!";
			W.setTimeout(() => {
				if (button.isConnected) {
					button.textContent = originalLabel;
					button.disabled = false;
				}
			}, 2e3);
		} catch (error) {
			button.textContent = "Copy failed";
			button.disabled = false;
			button.title = "Could not copy the loadout. Try again.";
			warn("Could not copy the profile loadout", error);
			W.setTimeout(() => {
				if (button.isConnected) {
					button.textContent = originalLabel;
					button.title = "Copy this loadout as text";
				}
			}, 2e3);
		}
	}
	function setProfileCollapsed(container, collapsed) {
		const toggle = container.querySelector(".kal-profile-toggle");
		const content = container.querySelector("[data-kal-profile-content]");
		if (!toggle || !content) return;
		container.classList.toggle("is-collapsed", collapsed);
		toggle.classList.toggle("active", !collapsed);
		toggle.setAttribute("aria-expanded", String(!collapsed));
		content.hidden = collapsed;
	}
	function enableProfileCollapse(container) {
		setProfileCollapsed(container, preferences.profileCollapsed);
		container.querySelector(".kal-profile-toggle")?.addEventListener("click", () => {
			const collapsed = !container.classList.contains("is-collapsed");
			setProfileCollapsed(container, collapsed);
			setPreference("profileCollapsed", collapsed);
		});
	}
	function firstDirectProfileRow(root) {
		const layout = (root instanceof HTMLElement && root.classList.contains("user-profile") ? root : root.querySelector(".user-profile")) ?? root;
		for (const child of Array.from(layout.children)) if (child instanceof HTMLElement && child.classList.contains("profile-wrapper")) return child;
		return null;
	}
	function placeProfilePanel(container, firstProfileRow) {
		const parent = firstProfileRow.parentElement;
		if (!parent) {
			firstProfileRow.after(container);
			return;
		}
		const place = () => {
			const currentFirstRow = firstDirectProfileRow(parent) ?? firstProfileRow;
			if (currentFirstRow.nextElementSibling !== container) currentFirstRow.after(container);
		};
		profilePlacementObserver?.disconnect();
		place();
		profilePlacementObserver = new MutationObserver(() => {
			if (!parent.isConnected) {
				profilePlacementObserver?.disconnect();
				profilePlacementObserver = null;
				return;
			}
			place();
		});
		profilePlacementObserver.observe(parent, { childList: true });
	}
	function replaceMountedProfilePanel(existing, container) {
		const focused = W.document.activeElement;
		const focusedDirection = focused instanceof HTMLElement ? focused.dataset.direction : void 0;
		existing.className = container.className;
		const mode = container.dataset.kalProfileMode;
		if (mode === void 0) delete existing.dataset.kalProfileMode;
		else existing.dataset.kalProfileMode = mode;
		preserveProfileItemImages(existing, container);
		destroyTornTooltips(existing);
		existing.replaceChildren(...container.childNodes);
		if (focusedDirection) {
			const restored = existing.querySelector(`.kal-profile-history-button[data-direction="${focusedDirection}"]`);
			if (restored && !restored.disabled) restored.focus();
		}
		return existing;
	}
	async function mountProfilePanel(container, generation) {
		const profileRoot = await waitForElement(".user-profile, #profileroot");
		const firstRow = (profileRoot ? firstDirectProfileRow(profileRoot) : null) || await waitForElement(".user-profile > .profile-wrapper, #profileroot > .profile-wrapper");
		if (!firstRow || !currentProfileGeneration(generation)) return null;
		const existing = W.document.getElementById("kal-profile-loadout");
		if (existing && existing !== container) return replaceMountedProfilePanel(existing, container);
		if (existing === container) return existing;
		placeProfilePanel(container, firstRow);
		return container;
	}
	function syncProfileRetryButton(button, retryAt, now = Date.now()) {
		const remaining = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1e3)) : 0;
		button.disabled = remaining > 0;
		button.textContent = remaining > 0 ? `Retry in ${remaining}s` : "Retry";
		return remaining;
	}
	async function renderProfileStatus(message, generation, { error = false, retry = false, retryAfterSeconds = null } = {}) {
		if (!currentProfileGeneration(generation)) return;
		const { container, history, content } = createProfilePanelShell({
			toggleClass: "kal-profile-status-toggle",
			contentClass: `cont bottom-round kal-profile-status${error ? " is-error" : ""}`
		});
		container.dataset.kalProfileMode = "status";
		const text = W.document.createElement("span");
		text.textContent = message;
		appendProfileNotices(content);
		content.appendChild(text);
		let startRetryCountdown = null;
		if (retry) {
			const retryButton = W.document.createElement("button");
			retryButton.type = "button";
			retryButton.className = "kal-profile-retry";
			retryButton.setAttribute("aria-live", "off");
			const delay = Math.max(0, Math.ceil(Number(retryAfterSeconds) || 0));
			const retryAt = delay > 0 ? Date.now() + delay * 1e3 : 0;
			const syncRetryButton = () => {
				if (!currentProfileGeneration(generation)) return;
				if (syncProfileRetryButton(retryButton, retryAt) > 0 && retryButton.isConnected) W.setTimeout(syncRetryButton, 250);
			};
			retryButton.addEventListener("click", () => {
				if (retryButton.disabled) return;
				runSafely("Could not retry the profile loadout", () => loadProfilePage({ fresh: true }));
			});
			content.appendChild(retryButton);
			syncRetryButton();
			startRetryCountdown = syncRetryButton;
		}
		content.setAttribute("role", error ? "alert" : "status");
		content.setAttribute("aria-live", "polite");
		mountProfileSettingsButton(history);
		const mounted = await mountProfilePanel(container, generation);
		if (mounted) {
			enableProfileCollapse(mounted);
			startRetryCountdown?.();
		}
	}
	async function renderProfileLoadout(loadout, targetId, generation = profileGeneration) {
		if (!currentProfileGeneration(generation)) return;
		if (!loadout) return;
		const { container, toggle, caret, history, content } = createProfilePanelShell({ contentClass: "cont bottom-round kal-profile-content" });
		container.dataset.kalProfileMode = "loadout";
		const age = W.document.createElement("span");
		age.className = "kal-profile-age";
		age.textContent = formatCaptureAge(loadout.observed_at);
		age.title = `Captured ${new Date(loadout.observed_at).toLocaleString()}`;
		toggle.insertBefore(age, caret);
		const copy = W.document.createElement("button");
		copy.type = "button";
		copy.className = "kal-profile-history-button kal-profile-copy-button";
		copy.textContent = "Copy";
		copy.title = "Copy this loadout as text";
		copy.setAttribute("aria-label", copy.title);
		withDismissableTooltip(copy);
		copy.addEventListener("click", () => {
			copyProfileLoadout(loadout, copy);
		});
		const older = W.document.createElement("button");
		older.type = "button";
		older.className = "kal-profile-history-button";
		older.dataset.direction = "older";
		older.textContent = "‹";
		older.title = "Show the previous distinct loadout";
		older.setAttribute("aria-label", older.title);
		withDismissableTooltip(older);
		older.disabled = profileHistoryLoading || loadout.has_previous !== true;
		older.addEventListener("click", () => {
			runSafely("Could not load the previous profile loadout", () => showOlderProfileLoadout(targetId, older));
		});
		const newer = W.document.createElement("button");
		newer.type = "button";
		newer.className = "kal-profile-history-button";
		newer.dataset.direction = "newer";
		newer.textContent = "›";
		newer.title = "Show a newer loadout";
		newer.setAttribute("aria-label", newer.title);
		withDismissableTooltip(newer);
		newer.disabled = profileHistoryLoading || profileHistoryIndex === 0;
		newer.addEventListener("click", () => {
			if (profileHistoryLoading || profileHistoryIndex === 0) return;
			profileHistoryIndex -= 1;
			const selected = profileHistory[profileHistoryIndex];
			if (!selected) return;
			runSafely("Could not show the newer profile loadout", () => renderProfileLoadout(selected, targetId));
		});
		history.append(copy, older, newer);
		mountProfileSettingsButton(history);
		const mobileJob = preferences.showProfileJobSpecials && (profileJobSpecials.length || profileJobLoading() || profileJobUnavailable()) ? profileSection([], {}, profileJobSpecialsRow(profileJobSpecials, {
			mobile: true,
			loading: profileJobLoading(),
			unavailable: profileJobUnavailable(),
			unavailableMessage: profileJobSpecialsUnavailableMessage
		})) : null;
		if (mobileJob) {
			mobileJob.classList.add("kal-profile-mobile-job-section");
			mobileJob.dataset.kalProfileMobileJobSection = "";
		}
		appendProfileNotices(content, loadout.latest_version);
		content.append(profileSection(PROFILE_WEAPON_SLOTS, loadout.items, preferences.showProfileJobSpecials ? profileJobSpecialsRow(profileJobSpecials, {
			loading: profileJobLoading(),
			unavailable: profileJobUnavailable(),
			unavailableMessage: profileJobSpecialsUnavailableMessage
		}) : null, { reserveTrailingPlaceholder: true }), profileSection(PROFILE_ARMOR_SLOTS, loadout.items, null, { emptyText: "No armor recorded." }));
		if (mobileJob) content.appendChild(mobileJob);
		const mounted = await mountProfilePanel(container, generation);
		if (!mounted) return;
		if (!currentProfileGeneration(generation)) return;
		enableProfileCollapse(mounted);
		initializeTornTooltips(mounted);
	}
	async function showOlderProfileLoadout(targetId, button) {
		if (profileHistoryLoading) return;
		button.title = "Show the previous distinct loadout";
		button.setAttribute("aria-label", button.title);
		delete button.dataset.error;
		const generation = profileGeneration;
		const cached = profileHistory[profileHistoryIndex + 1];
		if (cached) {
			profileHistoryIndex += 1;
			await renderProfileLoadout(cached, targetId, generation);
			return;
		}
		const current = profileHistory[profileHistoryIndex];
		if (!current?.history_cursor || current.has_previous !== true) return;
		profileHistoryLoading = true;
		syncProfileHistoryControls();
		const result = await readProfileLoadout(targetId, {
			before: current.history_cursor,
			includeJobSpecials: false
		});
		if (result.status === "ok") receiveProfileResponseNotification(result.data);
		const loadout = result.status === "ok" && result.data.target_id === targetId ? result.data : null;
		if (!currentProfileGeneration(generation)) return;
		profileHistoryLoading = false;
		if (loadout) {
			profileHistory.push(loadout);
			profileHistoryIndex += 1;
			await renderProfileLoadout(loadout, targetId, generation);
		} else if (result.status === "missing") {
			current.has_previous = false;
			button.title = "No earlier distinct loadout has been captured";
			button.setAttribute("aria-label", button.title);
			syncProfileHistoryControls();
		} else {
			syncProfileHistoryControls();
			if (result.status === "update-required") {
				surfaceMandatoryUpgradeOnProfile();
				button.title = "Update KAL to load the previous loadout";
				button.setAttribute("aria-label", button.title);
				button.dataset.error = "true";
				return;
			}
			if (result.status === "ok") warn("Profile history returned the wrong target", null, { playerId: targetId });
			button.title = "Could not load the previous loadout. Try again.";
			button.setAttribute("aria-label", button.title);
			button.dataset.error = "true";
		}
	}
	async function renderProfileRequestFailure(result, generation) {
		if (result.status === "missing") {
			await renderProfileNoLoadout(generation);
			return;
		}
		if (result.status === "no-key") {
			await renderProfileStatus("Connect a Torn API key from the gear above.", generation);
			return;
		}
		if (result.status === "auth-error") {
			await renderProfileStatus("Reconnect a Torn API key from the gear above.", generation, { error: true });
			return;
		}
		if (result.status === "account-unavailable") {
			await renderProfileStatus(result.message, generation, { error: true });
			return;
		}
		if (result.status === "update-required") {
			await renderProfileStatus(result.message, generation, { error: true });
			return;
		}
		if (result.status !== "error") return;
		await renderProfileStatus(result.message, generation, {
			error: true,
			retry: result.retryable,
			retryAfterSeconds: result.retryAfterSeconds
		});
	}
	async function loadProfilePage({ fresh = false } = {}) {
		if (PAGE.type !== "profile") return;
		const generation = profileGeneration + 1;
		profileGeneration = generation;
		const bundledJobGeneration = profileJobGeneration + 1;
		profileJobGeneration = bundledJobGeneration;
		if (!preferences.showProfileLoadouts || shouldHideOnOwnProfilePage()) {
			clearProfilePage();
			return;
		}
		const targetId = PAGE.playerId;
		if (!targetId) return;
		profileHistory = [];
		profileHistoryIndex = 0;
		profileHistoryLoading = false;
		profileJobSpecials = [];
		profileJobSpecialsState = "idle";
		profileJobSpecialsUnavailableMessage = null;
		const request = startProfilePrefetch({ fresh }) || readProfileLoadout(targetId, { includeJobSpecials: preferences.showProfileJobSpecials });
		await renderProfileStatus("Loading loadout information…", generation);
		const result = await request;
		if (result.status === "ok") receiveProfileResponseNotification(result.data);
		const loadout = result.status === "ok" && result.data.target_id === targetId ? result.data : null;
		if (!currentProfileGeneration(generation)) return;
		if (loadout) {
			profileHistory = [loadout];
			if (bundledJobGeneration === profileJobGeneration) {
				profileJobSpecials = loadout.job_specials;
				profileJobSpecialsState = "ready";
				profileJobSpecialsUnavailableMessage = null;
			}
			await renderProfileLoadout(loadout, targetId, generation);
		} else if (result.status === "missing") {
			await renderProfileNoLoadout(generation);
			if (preferences.showProfileJobSpecials && bundledJobGeneration === profileJobGeneration) await refreshProfileJobSpecials();
		} else if (result.status !== "ok") await renderProfileRequestFailure(result, generation);
		else {
			warn("Profile loadout returned the wrong target", null, { playerId: targetId });
			await renderProfileStatus("KAL returned loadout information for a different player. Please try again.", generation, {
				error: true,
				retry: true
			});
		}
	}
	var attack_default = "#kal-attack-job-specials{clear:both;box-sizing:border-box;min-width:0;color:var(--default-color,#333);margin:5px 0;font:11px/1.35 Arial,sans-serif;display:block}#kal-attack-job-specials .kal-attack-job-specials-label{margin-right:6px;font-weight:700}#kal-attack-job-specials .kal-attack-job-specials-content{white-space:normal;overflow-wrap:anywhere}#kal-attack-job-specials .kal-attack-job-specials-separator{color:var(--default-color-light,#777);margin:0 6px}#kal-attack-job-specials .kal-attack-job-specials-state{color:var(--default-color-light,#777);font-style:italic}#kal-attack-job-specials .kal-attack-job-specials-state.has-specials:before{content:\" · \"}#kal-attack-job-specials[data-state=unavailable] .kal-attack-job-specials-state{opacity:.8}@media (width<=700px){#kal-attack-job-specials{margin:4px 0;font-size:10px;line-height:1.4}}#kal-attack-job-specials[data-state=compatibility]{color:var(--error-color,#b3261e)}#kal-attack-job-specials[data-state=compatibility] a{color:inherit;font-weight:700}#kal-loadout-controls-slot{flex:none;align-items:center;min-width:0;margin-left:10px;display:inline-flex}[class*=titleContainer].kal-loadout-title-row{align-items:center;min-width:0;display:flex}[class*=titleContainer].kal-loadout-title-row>h4{text-overflow:ellipsis;white-space:nowrap;flex:auto;min-width:0;overflow:hidden}#kal-loadout-controls-slot[hidden]{display:none!important}#kal-loadout-stamp{box-sizing:border-box;border:1px solid var(--panel-divider-outer-side-color,#7f7f7f59);background:var(--default-bg-panel-color,#fff);min-width:0;height:30px;color:var(--default-color,#333);white-space:nowrap;border-radius:6px;align-items:center;padding:0 10px;font-size:11px;display:inline-flex}#kal-loadout-stamp[hidden]{display:none!important}#kal-loadout-stamp[data-state=loading]:before{box-sizing:border-box;content:\"\";border:2px solid;border-right-color:#0000;border-radius:50%;width:12px;height:12px;animation:.7s linear infinite kal-loadout-throbber}@keyframes kal-loadout-throbber{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){#kal-loadout-stamp[data-state=loading]:before{animation-duration:1.4s}}#kal-loadout-history{gap:2px;height:30px;display:inline-flex}#kal-loadout-history[hidden]{display:none!important}#kal-loadout-history button{appearance:none;border:1px solid var(--panel-divider-outer-side-color,#7f7f7f59);background:var(--default-bg-panel-color,#fff);width:26px;height:30px;color:var(--default-color-light,#777);cursor:pointer;border-radius:6px;margin:0;padding:0 0 2px;font:18px/1 Arial,sans-serif}#kal-loadout-history button:hover:not(:disabled){filter:brightness(1.08)}#kal-loadout-history button:focus-visible{outline:2px solid var(--default-blue-color,#4b91c8);outline-offset:2px}#kal-loadout-history button:disabled{cursor:default;opacity:.4}#kal-loadout-history button[data-error=true]{color:#b93c4b;border-color:#b93c4b}html.kal-loadout-attack-page [class*=modal][class*=defender]{-webkit-backdrop-filter:none!important;pointer-events:none!important;background:0 0!important}@media (width<=700px){#kal-loadout-controls-slot{margin-left:4px}#kal-loadout-stamp{text-overflow:ellipsis;padding:0 5px;font-size:0;overflow:hidden;min-width:0!important}#kal-loadout-stamp:after{content:attr(data-compact);white-space:nowrap;font-size:11px}#kal-loadout-history{flex:none}}.kal-attack-labelled-weapon{position:relative}.kal-attack-weapon-details{z-index:11;box-sizing:border-box;color:var(--default-color,#333);text-align:right;pointer-events:none;flex-direction:column;align-items:flex-end;padding:16px 9px;font:10px/1.2 Arial,sans-serif;display:flex;position:absolute;inset:0}.kal-attack-detail-line{text-overflow:ellipsis;white-space:nowrap;max-width:100%;display:block;overflow:hidden}.kal-attack-item-name{text-align:center;max-width:none;position:absolute;bottom:16px;left:9px;right:9px}[id^=weapon_][aria-describedby*=attacker]>.kal-attack-weapon-details,[id^=weapon_][aria-labelledby*=attacker]>.kal-attack-weapon-details{display:none}@media (width<=784px){.kal-attack-weapon-details{padding:14px 4px;font-size:9px;line-height:1.1}.kal-attack-detail-line{overflow-wrap:break-word;text-overflow:clip;white-space:normal;max-width:100%;overflow:visible}.kal-attack-item-name{line-height:1.1;bottom:14px;left:4px;right:4px}}";
	var profile_default = "#kal-profile-loadout{box-sizing:border-box;width:100%;color:var(--default-color,#333);position:relative;container:kal-profile-loadout/inline-size}#kal-profile-loadout .kal-profile-status{box-sizing:border-box;background:var(--default-bg-panel-color,#fff);min-height:42px;color:var(--default-color-light,#777);grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:12px 10px;font-size:11px;font-weight:400;line-height:1.4;display:grid}#kal-profile-loadout .kal-profile-status[hidden]{display:none!important}#kal-profile-loadout .kal-profile-status.is-error{color:#d34f5d}#kal-profile-loadout .kal-profile-retry{border:1px solid var(--panel-divider-outer-side-color,#ccc);background:var(--default-bg-panel-color,#fff);color:var(--default-color,#333);cursor:pointer;font:inherit;border-radius:4px;flex:none;margin-left:auto;padding:3px 8px}#kal-profile-loadout .kal-profile-retry:focus-visible{outline:2px solid var(--default-blue-color,#4b91c8);outline-offset:1px}#kal-profile-loadout .kal-profile-retry:disabled{cursor:default;opacity:.55}#kal-profile-loadout .kal-profile-update-link{align-items:center;text-decoration:none;display:inline-flex}#kal-profile-loadout .kal-profile-toggle{appearance:none;width:100%;min-height:30px;font:inherit;text-align:left;cursor:pointer;-webkit-user-select:none;user-select:none;border:0;border-radius:5px 5px 0 0;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;margin:0;padding:0 140px 0 10px;display:grid!important}#kal-profile-loadout .kal-profile-status-toggle{grid-template-columns:minmax(0,1fr) auto;padding-right:10px}#kal-profile-loadout.is-collapsed .kal-profile-toggle{box-shadow:none;border-radius:5px}#kal-profile-loadout .kal-profile-toggle:hover{filter:brightness(1.08)}#kal-profile-loadout .kal-profile-toggle:focus-visible{outline:2px solid var(--default-blue-color,#4b91c8);outline-offset:2px}#kal-profile-loadout .kal-profile-title{text-overflow:ellipsis;white-space:nowrap;letter-spacing:.4px;min-width:0;font-size:13px;font-weight:700;overflow:hidden}@container kal-profile-loadout (width<=480px){#kal-profile-loadout .kal-profile-title-prefix{display:none}}#kal-profile-loadout .kal-profile-age{color:var(--default-color-light,#aaa);white-space:nowrap;font-size:9px;font-weight:400}#kal-profile-loadout .kal-profile-status-toggle{padding-right:44px}#kal-profile-loadout .kal-profile-caret{color:var(--default-color-light,#aaa);font-size:9px;transition:transform .15s;display:inline-block}#kal-profile-loadout.is-collapsed .kal-profile-caret{transform:rotate(-90deg)}#kal-profile-loadout .kal-profile-history{z-index:2;gap:3px;display:flex;position:absolute;top:4px;right:8px}#kal-profile-loadout .kal-profile-history-button{appearance:none;border:1px solid var(--panel-divider-outer-side-color,#7f7f7f59);background:var(--default-bg-panel-color,#fff);width:22px;height:22px;color:var(--default-color,#333);cursor:pointer;border-radius:3px;place-items:center;margin:0;padding:0 0 2px;font:18px/1 Arial,sans-serif;display:inline-grid}#kal-profile-loadout .kal-profile-copy-button{width:auto;padding:0 7px;font-size:10px}#kal-profile-loadout .kal-profile-settings-button{color:var(--default-color,#333);margin-left:4px;padding:0;font-family:Arial,sans-serif;font-size:13px;font-weight:400;line-height:1}#kal-profile-loadout .kal-profile-history-button:hover:not(:disabled){filter:brightness(1.08)}#kal-profile-loadout .kal-profile-history-button:focus-visible{outline:2px solid var(--default-blue-color,#4b91c8);outline-offset:1px}#kal-profile-loadout .kal-profile-history-button:disabled{cursor:default;opacity:.35}#kal-profile-loadout .kal-profile-history-button[data-error=true]{color:#b93c4b;border-color:#b93c4b}#kal-profile-loadout .kal-profile-content{background:var(--default-bg-panel-color,#fff);grid-template-columns:minmax(0,11fr) minmax(0,9fr);padding:0;display:grid;overflow:hidden}#kal-profile-loadout .kal-profile-content-no-loadout{grid-template-columns:minmax(0,1fr)}#kal-profile-loadout .kal-profile-no-loadout-status{box-sizing:border-box;background:var(--default-bg-panel-color,#fff);min-height:42px;color:var(--default-color-light,#777);padding:12px 10px;font-size:11px;font-weight:400;line-height:1.4}#kal-profile-loadout .kal-profile-content[hidden]{display:none!important}#kal-profile-loadout .kal-profile-notification{border-bottom:1px solid var(--panel-divider-outer-side-color,#ccc);border-left:3px solid var(--default-blue-color,#4b91c8);min-width:0;color:var(--default-color,#333);background:#4b91c812;grid-column:1/-1;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;column-gap:8px;padding:7px 8px;font-size:11px;line-height:1.3;display:grid}#kal-profile-loadout .kal-profile-notification-copy{min-width:0}#kal-profile-loadout .kal-profile-notification-message{min-width:0;display:block}#kal-profile-loadout .kal-profile-notification-link{border:1px solid var(--panel-divider-outer-side-color,#ccc);background:var(--default-bg-panel-color,#fff);color:var(--default-color,#333);white-space:nowrap;border-radius:3px;align-self:center;padding:3px 6px;font-size:9px;font-weight:700;line-height:1.2;text-decoration:none}#kal-profile-loadout .kal-profile-notification-link:hover{background:#0000000a;text-decoration:none}#kal-profile-loadout .kal-profile-notification-dismiss{appearance:none;width:20px;height:20px;color:var(--default-color-light,#777);cursor:pointer;background:0 0;border:0;border-radius:3px;flex:none;margin:0 -2px 0 0;padding:0;font:18px/1 Arial,sans-serif}#kal-profile-loadout .kal-profile-notification-dismiss:hover{color:var(--default-color,#333);background:#0000000f}#kal-profile-loadout .kal-profile-notification-link:focus-visible,#kal-profile-loadout .kal-profile-notification-dismiss:focus-visible{outline:2px solid var(--default-blue-color,#4b91c8);outline-offset:1px}@container kal-profile-loadout (width<=360px){#kal-profile-loadout .kal-profile-notification{grid-template-columns:minmax(0,1fr) auto;row-gap:5px}#kal-profile-loadout .kal-profile-notification-link{grid-column:1;justify-self:start}#kal-profile-loadout .kal-profile-notification-dismiss{grid-area:1/2}}#kal-profile-loadout .kal-profile-section{min-width:0;margin:0}#kal-profile-loadout .kal-profile-no-loadout-status+.kal-profile-section{border-top:1px solid var(--panel-divider-outer-side-color,#ccc)}#kal-profile-loadout .kal-profile-section+.kal-profile-section{border-left:1px solid var(--panel-divider-outer-side-color,#ccc)}#kal-profile-loadout .kal-profile-list{grid-template-rows:repeat(5,minmax(44px,1fr));margin:0;padding:0;list-style:none;display:grid}#kal-profile-loadout .kal-profile-job-only-list{grid-template-rows:minmax(44px,auto)}#kal-profile-loadout .kal-profile-item{box-sizing:border-box;border-bottom:1px solid var(--panel-divider-outer-side-color,#ccc);grid-template-columns:64px minmax(0,1fr);align-items:start;gap:8px;min-height:44px;padding:6px 8px;display:grid}#kal-profile-loadout .kal-profile-item:nth-child(2n){background:#00000009}#kal-profile-loadout .kal-profile-item:last-child{border-bottom:0}#kal-profile-loadout .kal-profile-placeholder{pointer-events:none}@container kal-profile-loadout (width>=761px){#kal-profile-loadout .kal-profile-section{flex-direction:column;display:flex}#kal-profile-loadout .kal-profile-list{flex:auto;height:100%;min-height:0}}#kal-profile-loadout .kal-profile-job-label{color:var(--default-color,#333);letter-spacing:.3px;font-size:14px;font-weight:400}#kal-profile-loadout .kal-profile-job-effects{flex-direction:column;justify-content:center;align-self:stretch;gap:2px;min-width:0;min-height:0;display:flex;overflow:hidden}#kal-profile-loadout .kal-profile-job-row{align-items:center;gap:10px;min-width:0;display:flex}#kal-profile-loadout .kal-profile-job-effect{min-width:0;color:var(--default-color,#333);opacity:.78;white-space:nowrap;flex:0 auto;align-items:center;gap:3px;font-size:10px;font-weight:400;line-height:1;display:flex;overflow:hidden}#kal-profile-loadout .kal-profile-job-count-1 .kal-profile-job-effect,#kal-profile-loadout .kal-profile-job-count-2 .kal-profile-job-effect{font-size:11px}#kal-profile-loadout .kal-profile-job-bullet{color:var(--default-color-light,#777);flex:none}#kal-profile-loadout .kal-profile-job-effect-text{text-overflow:ellipsis;min-width:0;overflow:hidden}#kal-profile-loadout .kal-profile-job-empty{text-overflow:ellipsis;display:block}#kal-profile-loadout .kal-profile-mobile-job-section{display:none}#kal-profile-loadout .kal-profile-image-wrap{box-sizing:border-box;justify-content:center;align-items:center;width:60px;height:32px;display:flex;overflow:hidden}#kal-profile-loadout .kal-profile-details{flex-direction:column;align-self:stretch;gap:2px;min-width:0;min-height:32px;display:flex}#kal-profile-loadout .kal-profile-name-line{flex-wrap:wrap;align-items:center;gap:4px;min-width:0;display:flex}#kal-profile-loadout .kal-profile-item-name{min-width:0;max-width:100%;color:var(--default-color,#333);text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:400;line-height:1.35;overflow:hidden}#kal-profile-loadout .kal-profile-name-separator{background:var(--panel-divider-outer-side-color,#aaa);flex:0 0 1px;align-self:center;width:1px;height:12px;margin:0 2px}#kal-profile-loadout .kal-profile-bonus-content{min-width:0;max-width:100%;color:var(--default-color,#333);text-shadow:none;white-space:nowrap;flex:0 auto;align-self:center;align-items:center;font-size:12px;font-weight:400;line-height:1.35;display:inline-flex;position:relative;overflow:visible}#kal-profile-loadout .kal-profile-bonus-icon{flex:none;margin:0}#kal-profile-loadout .kal-profile-bonus-label{text-overflow:ellipsis;flex:auto;min-width:0;overflow:hidden}#kal-profile-loadout .kal-profile-bonus-bar{background-position:0;background-repeat:no-repeat;background-size:100% 100%;border-radius:2px;height:2px;position:absolute;bottom:-2px;left:0;right:0}#kal-profile-loadout .kal-profile-upgrades{min-width:0;color:var(--default-color,#333);opacity:.78;text-overflow:ellipsis;white-space:nowrap;flex:auto;font-size:11px;font-weight:400;line-height:1.35;display:block;overflow:hidden}#kal-profile-loadout .kal-profile-ammo{letter-spacing:.02em;opacity:1;flex:none;margin-left:auto;overflow:visible}#kal-profile-loadout .kal-profile-ammo.is-standard{color:var(--default-color,#333);opacity:.78}#kal-profile-loadout .kal-profile-ammo.is-empty{color:var(--default-color,#333);opacity:.62}#kal-profile-loadout .kal-profile-mods{font-size:10px}#kal-profile-loadout .kal-profile-mod-line{display:inline}#kal-profile-loadout .kal-profile-stats{flex:none;align-items:center;gap:6px;min-width:0;display:flex}#kal-profile-loadout .kal-profile-stat{font-variant-numeric:tabular-nums;align-items:center;gap:2px;min-width:0;display:inline-flex}#kal-profile-loadout .kal-profile-stat i{opacity:.78;flex:none}#kal-profile-loadout .kal-profile-stat-value{color:var(--default-color,#333);opacity:.78;font-size:11px;font-weight:400;line-height:1.35}#kal-profile-loadout .kal-profile-lower-line{align-items:center;gap:8px;min-width:0;margin-top:auto;display:flex}#kal-profile-loadout .kal-profile-lower-separator{background:var(--panel-divider-outer-side-color,#aaa);opacity:.8;flex:0 0 1px;align-self:center;width:1px;height:11px}#kal-profile-loadout .kal-profile-empty{color:var(--default-color-light,#888);text-align:center;padding:11px 10px;font-size:10px;font-style:italic}@container kal-profile-loadout (width<=760px){#kal-profile-loadout .kal-profile-content{grid-template-columns:minmax(0,1fr)}#kal-profile-loadout .kal-profile-section+.kal-profile-section{border-top:1px solid var(--panel-divider-outer-side-color,#ccc);border-left:0}#kal-profile-loadout .kal-profile-list{display:block}#kal-profile-loadout .kal-profile-placeholder,#kal-profile-loadout .kal-profile-job-specials:not(.kal-profile-job-mobile){display:none}#kal-profile-loadout .kal-profile-mobile-job-section{display:block}#kal-profile-loadout .kal-profile-no-loadout-job-desktop{display:none}#kal-profile-loadout .kal-profile-item{grid-template-columns:62px minmax(0,1fr);align-items:start;gap:8px;min-height:50px;padding:6px 8px}#kal-profile-loadout .kal-profile-item-name{max-width:100%}#kal-profile-loadout .kal-profile-bonus-content{font-size:11px}#kal-profile-loadout .kal-profile-upgrades{overflow-wrap:anywhere;text-overflow:clip;white-space:normal}#kal-profile-loadout .kal-profile-mods{overflow:hidden}#kal-profile-loadout .kal-profile-mod-line{text-overflow:ellipsis;vertical-align:top;white-space:nowrap;max-width:100%;display:inline-block;overflow:hidden}}";
	var shared_default = "#kal-loadout-settings{min-width:0;max-width:100%;color:var(--default-color,#333);align-items:center;gap:8px;margin-left:8px;font:12px/1.35 Arial,sans-serif;display:inline-flex;position:relative}#kal-loadout-settings.is-fallback{z-index:2147483646;margin-left:0;position:fixed;top:52px;right:10px}#kal-loadout-settings .kal-settings-button{box-sizing:border-box;border:1px solid var(--panel-divider-outer-side-color,#7f7f7f59);background:var(--default-bg-panel-color,#fff);min-width:0;height:30px;box-shadow:var(--items-plate-box-shadow,0 2px 6px #0003);color:var(--default-color,#333);cursor:pointer;font:inherit;text-overflow:ellipsis;white-space:nowrap;border-radius:6px;padding:0 10px;font-size:11px;font-weight:700;overflow:hidden}#kal-loadout-settings .kal-settings-button:hover{filter:brightness(1.08)}#kal-loadout-settings .kal-settings-button:focus-visible,#kal-loadout-settings-panel .kal-settings-action:focus-visible,#kal-loadout-settings-panel .kal-settings-input:focus-visible{outline:2px solid var(--default-blue-color,#4b91c8);outline-offset:2px}#kal-loadout-settings-panel{z-index:2147483647;box-sizing:border-box;border:1px solid var(--panel-divider-outer-side-color,#7f7f7f59);background:var(--default-bg-panel-color,#fff);color:var(--default-color,#333);border-radius:8px;padding:11px;font:12px/1.35 Arial,sans-serif;position:fixed;overflow:auto;box-shadow:0 10px 28px #00000059}#kal-loadout-settings-panel[hidden]{display:none!important}#kal-loadout-settings-panel .kal-settings-heading{margin-bottom:8px;font-size:14px;font-weight:700}#kal-loadout-settings-panel .kal-settings-key-label,#kal-loadout-settings-panel .kal-settings-section-title{color:var(--default-color,#333);margin:8px 0 4px;font-size:11px;font-weight:700;display:block}#kal-loadout-settings-panel .kal-settings-intro,#kal-loadout-settings-panel .kal-settings-toggle{color:var(--default-color-light,#777)}#kal-loadout-settings-panel .kal-settings-intro{margin-bottom:8px}#kal-loadout-settings-panel .kal-settings-links{flex-wrap:wrap;gap:10px;margin:8px 0;font-size:11px;display:flex}#kal-loadout-settings-panel .kal-settings-link{color:var(--default-blue-color,#3979a9);text-decoration:none}#kal-loadout-settings-panel .kal-settings-input{box-sizing:border-box;border:1px solid var(--panel-divider-outer-side-color,#7f7f7f59);background:var(--default-bg-panel-color,#fff);width:100%;color:var(--default-color,#333);border-radius:6px;margin:2px 0 8px;padding:8px}#kal-loadout-settings-panel .kal-settings-actions{gap:6px;margin-bottom:10px;display:flex}#kal-loadout-settings-panel .kal-settings-feedback{color:var(--default-color-light,#777);margin:-4px 0 10px;font-size:11px}#kal-loadout-settings-panel .kal-settings-feedback.is-error{color:#b93c4b}#kal-loadout-settings-panel .kal-settings-feedback a{color:inherit;font-weight:700}#kal-loadout-settings-panel .kal-settings-toggle{cursor:pointer;align-items:flex-start;gap:7px;margin:8px 0;font-size:11px;display:flex}#kal-loadout-settings-panel .kal-settings-action{cursor:pointer}#kal-loadout-settings-panel .kal-settings-action:disabled{cursor:default;opacity:.65}@media (width<=700px){#kal-loadout-settings{gap:5px;margin-left:4px}#kal-loadout-settings .kal-settings-button{padding:0 8px;font-size:0}#kal-loadout-settings .kal-settings-button:after{content:\"KAL\";font-size:11px}}";
	function installRevealerStyles() {
		const style = W.document.createElement("style");
		style.dataset.kalLoadoutRevealer = "styles";
		style.textContent = `${shared_default}\n${PAGE.type === "attack" ? attack_default : profile_default}`;
		const mount = () => {
			if (style.isConnected) return;
			(W.document.head || W.document.documentElement)?.appendChild(style);
		};
		mount();
		if (!style.isConnected) W.document.addEventListener("DOMContentLoaded", mount, { once: true });
	}
	function onDOMReady() {
		if (PAGE.type === "unsupported") return;
		W.console?.info?.(`[${SCRIPT_NAME}] Loaded v${SCRIPT_VERSION}`);
		W.document.documentElement.classList.toggle("kal-loadout-attack-page", PAGE.type === "attack");
		if (PAGE.type === "attack") runSafely("Could not initialize attack controls", async () => {
			await mountAttackControls();
		});
		else runSafely("Could not initialize the profile loadout", loadProfilePage);
	}
	function resumeAuthenticatedFeatures() {
		if (PAGE.type === "attack") {
			runSafely("Could not resume the loadout upload", uploadPendingCapture);
			startAttackRevealPrefetch();
			if (!preferences.showAttackLoadouts) runSafely("Could not refresh attack job specials", refreshAttackJobSpecials);
			return;
		}
		runSafely("Could not refresh the profile loadout", () => loadProfilePage({ fresh: true }));
	}
	function startAttackPage() {
		startAttackRevealPrefetch();
		if (!preferences.showAttackLoadouts) runSafely("Could not load attack job specials", refreshAttackJobSpecials);
	}
	var attackRuntimeReady = false;
	function surfaceLegacyWarHelperConflict() {
		const conflict = legacyWarHelperConflict();
		if (!conflict) return;
		if (PAGE.type === "attack") {
			showAttackWarHelperCompatibilityWarning();
			return;
		}
		if (conflict === "running") runSafely("Could not show the War Helper compatibility warning", renderProfileWarHelperCompatibilityWarning);
		else surfaceProfileWarHelperCompatibilityNotice();
	}
	async function start() {
		const startup = [initializePreferences(), initializeApiKeyStorage()];
		if (PAGE.type === "profile") startup.push(initializeAccountStorage(), initializeNotificationStorage());
		await Promise.all(startup);
		attackRuntimeReady = true;
		initializeSettings({
			onAttackPreferenceChanged: (key) => {
				if (key === "showAttackLoadouts") {
					if (preferences.showAttackLoadouts) startAttackRevealPrefetch();
					else invalidateAttackReveal();
				}
				if (key === "showAttackJobSpecials") {
					if (preferences.showAttackJobSpecials) runSafely("Could not refresh attack job specials", refreshAttackJobSpecials);
					else clearAttackJobSpecials();
				}
				syncAttackView();
			},
			onProfilePreferenceChanged: (key) => {
				if (PAGE.type !== "profile") return;
				if (key === "hideProfileLoadoutOnOwnPage") {
					if (PAGE.playerId !== connectedTornId()) return;
					if (preferences.hideProfileLoadoutOnOwnPage) {
						clearProfilePage();
						return;
					}
				}
				if (key === "showProfileLoadouts" && !preferences.showProfileLoadouts) {
					clearProfilePage();
					return;
				}
				if (key === "showProfileJobSpecials") {
					runSafely(preferences.showProfileJobSpecials ? "Could not refresh profile job specials" : "Could not update profile presentation", preferences.showProfileJobSpecials ? refreshProfileJobSpecials : refreshProfilePresentationFromMemory);
					return;
				}
				runSafely("Could not refresh the profile loadout", () => loadProfilePage({ fresh: true }));
			},
			onAuthConnected: () => {
				resumeAuthenticatedFeatures();
			},
			onAuthRemoved: () => {
				disconnectAttackReveal();
				discardPendingCapture();
				clearAttackJobSpecials();
				if (PAGE.type === "profile") runSafely("Could not refresh the disconnected profile", () => loadProfilePage({ fresh: true }));
				else clearProfilePage();
			}
		});
		onAuthenticationFailure(() => {
			if (settingsOpen) runSafely("Could not refresh loadout settings", renderSettingsPanel);
			disconnectAttackReveal();
			discardPendingCapture();
			clearAttackJobSpecials();
		});
		if (PAGE.type === "attack") startAttackPage();
		else startProfilePrefetch();
		if (W.document.readyState === "loading") W.document.addEventListener("DOMContentLoaded", onDOMReady, { once: true });
		else onDOMReady();
	}
	var startRoot = W.document.documentElement;
	var alreadyStarted = startRoot?.hasAttribute("data-kal-loadout-revealer") ?? false;
	if (PAGE.type !== "unsupported" && !alreadyStarted) {
		startRoot?.setAttribute("data-kal-loadout-revealer", SCRIPT_VERSION);
		installLegacyWarHelperGuard();
		W.document.addEventListener(LEGACY_WAR_HELPER_EVENT, surfaceLegacyWarHelperConflict);
		installRevealerStyles();
		if (legacyWarHelperConflict() === "running") surfaceLegacyWarHelperConflict();
		else {
			if (PAGE.type === "attack") runSafely("Could not install the attackData listener", () => installAttackDataListener(() => attackRuntimeReady));
			runSafely("Could not start userscript", start);
		}
	}
})();
