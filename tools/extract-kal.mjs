import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=await readFile('vendor/kal/upstream.user.js','utf8');
function between(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);if(a<0||b<a)throw Error('KAL source layout changed; re-audit before extraction.');return source.slice(a,b);}
const parts=[
  between('\tfunction positiveInteger(', '\tfunction validTimestamp('),
  between('\tfunction attackDataDb(', '\tfunction formatWeaponBonusValue('),
  between('\tvar captureId = async', '\tvar COSMETIC_EQUIP_SLOT'),
  between('\tfunction tornNow(', '\tfunction formatCaptureAge('),
  between('\tfunction isRewrittenResponse(', '\tfunction shouldObserve(')
];
const hash=createHash('sha256').update(source).digest('hex');
const output=`// KAL 1.3.3 — Kalends [2032147]. All Rights Reserved.\n// Source incorporation/redistribution: user confirmation, 2026-11-19. See UPSTREAM.md.\n// Generated from upstream SHA-256 ${hash}; run tools/extract-kal.mjs.\n(function(global){'use strict';if(global.SLINK_KAL_CAPTURE)return;const W=global,PAGE_W=global;\n${parts.join('\n')}\nglobal.SLINK_KAL_CAPTURE=Object.freeze({buildAttackCapture,captureId,isAttackDataRequest,isRewrittenResponse,attackTargetId,attackStatus,attackAttackerId,tornNow});\n})(globalThis);\n`;
await writeFile('vendor/kal/capture.js',output);
console.log('Extracted unchanged upstream capture functions: '+hash);
