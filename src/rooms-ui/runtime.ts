// UI adapted from Torn Rooms by Manuel [3747263] / Manuel Cecchetto.
// https://github.com/manuelcecchetto/torn-rooms, revision 6dd9f46fa422f4a5da12dfe34465dd87242722e3.
// MIT license: vendor/torn-rooms/LICENSE. Torn-derived CSS/SVGs remain TORN LTD property.
// SLINK adaptation: no upstream API, login, store, transport or backend is included.
import nativeCSS from '../../vendor/torn-rooms/userscript/src/generated/torn-chat.css';
import extraCSS from '../../vendor/torn-rooms/userscript/src/extra.css';
import {h,text,icon,roomIcon,componentIcon,badge,cx,ago,themeAsset} from './dom';
import {textInput,checkbox,setting,actionButton} from './forms';
import {roomForm} from './roomForm';
export {h,text,icon,roomIcon,componentIcon,badge,cx,ago,checkbox,setting,actionButton,roomForm};
// The native bar is outside our shadow stylesheet: carry its SVG gradient and
// unread badge styling on the nodes rather than leaking CSS into Torn's DOM.
export function barIcon(name:string){const el=roomIcon(name);for(const stop of el.querySelectorAll('stop'))stop.setAttribute('stop-color',stop.id==='start'?'#ddd':'#999');return el;}
export function barBadge(count:number){const el=badge('messageCount___EWpiR',count);if(el){el.style.cssText='position:absolute;top:-14px;left:0;pointer-events:none';const label=el.firstElementChild as HTMLElement;label.style.cssText='background:#5c940d;border:1px solid #c0eb75;border-radius:9px;display:flex;align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 3px;color:white;font:700 12px Arial;box-shadow:0 0 5px #a9e34b80';}return el;}

// These are only sizing/integration rules, not a second visual theme. Visual classes,
// cards, headers, messages, form rows, swatches and icons come from Manuel's source.
export const css=nativeCSS+'\n'+extraCSS+`\n
:host{display:block;font:12px/normal Arial,sans-serif;color:#ddd;--chat-theme-dark:initial;--chat-theme-light: ;--chat-color-background:#333;--chat-color-surface:#000;--chat-color-border-primary:#444;--chat-color-border-secondary:#444;--chat-color-separator:#444;--chat-box-scroll-track:#333;--chat-box-scroll-thumb-bg:#666;--chat-color-link-default:#ddd;--chat-color-link-hover:white;--chat-color-error:#ffaaaa;--chat-color-success:#8ce99a}
*{box-sizing:border-box}button,input,select,textarea{font:inherit}button{cursor:pointer;background:transparent;color:inherit;border:0;padding:0}button:disabled{cursor:default;opacity:.5}a{color:#7bc7f4}[hidden],:host([hidden]){display:none!important}
.tr-panel{width:100%;height:100%;max-width:none;max-height:none;min-height:0;transform:none!important;transition:none}
.tr_content___aMpKJ,.tr_content___SMWAe,.tr_root___v2RvA{min-height:0}.tr_root___v2RvA{flex:1;position:relative}.tr_scrollWrapper___DmIrl{height:100%;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y}
.tr-scroll{min-height:0;flex:1;overscroll-behavior:contain;touch-action:pan-y}.tr_root___M9jgF{flex:none}.tr_root___FDeLd{background-color:transparent}
.tr-card{border:0;background:transparent;color:inherit;text-align:left;min-width:0}.tr-card .tr-card-icon{width:48px;height:48px}.tr-card .tr-card-icon svg{width:24px;height:24px}.tr-card .tr_wrapper___pXMZO{overflow:hidden}.tr-card .tr_content___LLeBK{max-width:none}.tr-card .tr_description____safi{margin:0}
.room-row{display:flex;align-items:center;position:relative}.room-entry{flex:1;min-width:0}.room-options{position:relative;flex:none;margin-right:5px}.room-options>summary{cursor:pointer;list-style:none;padding:6px}.room-options[open]{position:absolute;right:4px;z-index:3;background:#333;border:1px solid #555;padding:6px;max-width:180px}.room-options label{display:flex;align-items:center;gap:5px}
[data-home-view],[data-chat-view],[data-media-view]{flex:1;min-height:0}.tr-list{min-height:0}ol[data-messages]{padding:0;margin:0;list-style:none}.message{display:flex;flex-direction:column}.message .text{white-space:pre-wrap;overflow-wrap:anywhere}.message .meta{display:contents}.message .meta small{display:none}.message .meta a{color:inherit;font-weight:bold;text-decoration:none}.message .meta a:hover{text-decoration:underline}.message .preview{display:block;max-width:100%;max-height:180px;object-fit:contain}
.message a[data-room-media]{color:#9cdaff;overflow-wrap:anywhere}.message a[data-room-media]:focus-visible{outline:2px solid currentColor}
.tr-panel[data-room-theme] [data-scroller]{background:var(--tr-room-background) center/cover no-repeat;color:#f7f3ff}
.tr-panel[data-room-theme] .tr_box___eWW6m{background:#15101deb;color:#f7f3ff}
.tr-panel[data-room-theme] .tr_self___HgXOK .tr_box___eWW6m{background:#090711ed}
.tr-panel[data-room-theme] .tr_root___aBCjE,.tr-panel[data-room-theme] [data-room-details]{background:#17101f;color:#f7f3ff}
.tr-panel[data-room-theme] [data-draft]{color:#f7f3ff}
.tr-panel[data-room-theme] [data-draft]::placeholder{color:#c8bbd0}
.tr-panel[data-room-theme] .slink-chat-footer{color:#ddd;text-shadow:0 1px 3px #000}
[aria-label="Room theme"]{max-width:100%;padding:5px;color:#eee;background:#222;border:1px solid #777;border-radius:4px}
.tr_header___cccSy,.tr_root___tQsxi{flex:none;width:100%;height:38px;min-height:38px}.tr_header___cccSy .tr_title___ptIMK{min-width:0}.tr_header___cccSy .tr_actionButton___CPUK5{min-width:0;flex:1}.tr_header___cccSy [data-header-icon]{display:flex;flex:none}.tr_header___cccSy [data-header-icon] svg{width:22px;height:22px}
.slink-media-button{color:#ccc;padding:0 5px;font-size:10px;border:0;background:transparent;flex:none}.slink-media-button:hover{color:white}.slink-rooms-header-icon{margin-right:8px}
.tr_root___aBCjE .tr_textarea___JRbO5{box-sizing:content-box;height:26px;min-height:26px;max-height:72px}.tr_root___aBCjE{flex:none;min-height:42px}.slink-chat-footer{padding:8px 4px;text-align:center;color:#888;font-size:11px}
.notice{padding:6px 8px;margin:0;overflow-wrap:anywhere;max-height:100px;overflow:auto;background:#472727;color:#ffd5c9}.reply{border-left:2px solid #888;padding:4px;font-size:11px}.pending{padding:4px}.media-surface{min-height:0;overflow:auto;flex:1}.toolbar{display:flex;gap:5px;padding:5px;flex-wrap:wrap}
.message-menu{position:fixed;z-index:2147483647;min-width:140px;display:grid;padding:3px;background:#333;border:1px solid #555;box-shadow:0 2px 8px #0008}.message-menu button{border:0;background:transparent;color:#ddd;text-align:left;padding:7px 10px}.message-menu button:hover{background:#222}.message-menu strong{padding:5px}
.tr_root___Cnq5Q{min-height:0;overflow:auto;flex:1}.tr_root___Cnq5Q form{min-height:0}[data-personal-form]{position:relative;flex-direction:column}[data-personal-form]>[style*="display: contents"]{display:flex!important;flex:1;min-height:0}[data-personal-form] form{position:relative;min-height:0;flex:1;display:flex;flex-direction:column}
.tr_collection___MXn9U [role=button]:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #8bc9e3;outline-offset:-2px}
.slink-room-settings{padding:0}.slink-room-settings p{margin:6px 10px}.slink-room-settings .tr_root___D4fXT{margin:8px 0}.slink-room-settings details{margin:8px 10px}.slink-room-settings summary{cursor:pointer}.slink-room-settings .toolbar{padding:0}
.management{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:10px;align-items:start}.management>.group{position:relative;min-width:0;border:1px solid #444;background:#333}.management input:not([type=checkbox]),.management select,.management textarea{width:100%;min-width:0;padding:7px;background:#111;color:#ddd;border:1px solid #555}.management .field{display:block;padding:10px;border-bottom:1px solid #444}.management .field>span{display:block;margin-bottom:7px}.management .checks{padding:10px}.management .checks label{display:flex;gap:5px;margin:7px 0}.management .member-list{max-height:230px;overflow:auto;padding:4px}.management .member-row{display:flex;gap:6px;padding:5px}.management .member-row button{color:inherit;border:0;background:transparent;text-align:left}.management .member-row small{display:block;opacity:.7}.management>label,.management>[data-new-room]{grid-column:1/-1}.management .group>button{margin:5px}.management [data-metadata-form]{max-height:none}.management .tr_root___Cnq5Q{position:static;overflow:visible}.management .tr_collection___MXn9U{max-height:360px;overflow:auto}
.torn-btn{padding:6px 10px;background:linear-gradient(#555,#252525);border:1px solid #111;border-radius:5px;color:#eee;box-shadow:inset 0 1px #ffffff30;text-shadow:0 1px #000}.torn-btn:hover:not(:disabled){background:linear-gradient(#666,#333)}[data-home],[data-admin]{display:none!important}.tr_root___tQsxi [data-header-icon]{margin:0 8px}.tr_root___tQsxi .tr_textContainer___yU28H{flex:1}.tr_root___tQsxi [data-close]{margin-right:8px}
`;

// Adapted Directory.card. All server/user values enter as text nodes, never HTML.
export function card(opts:any){
 return h('button',{type:'button',c:`root___QOWpT tr-card ${opts.color?'tr-colored':''}`,style:opts.color?'--tr-room: '+opts.color:undefined,on:{click:opts.onClick},'aria-label':opts.label||opts.title},
 h('span',{c:'root___uxEGq largeWrapper___i8ZDk tr-card-icon'},opts.createIcon?componentIcon('createRoom'):roomIcon(opts.iconName)),
 h('div',{c:'wrapper___pXMZO'},h('div',{c:'header___PzxzT'},text('link1','title___BsFVo regular___hyk3H',{},opts.title),opts.metadata?text('body','metadata___n5Pj2',{},opts.metadata):null),
 h('div',{c:'content___LLeBK'},text('body','description____safi',{},h('span',{c:'root___RoNAh'},opts.description))),badge('messageCount___IqCpE',opts.unread||0)));
}
export function tabs(onTab:(name:string)=>void){
 const root=h('div',{c:'root___M9jgF',role:'tablist','aria-label':'Rooms'});
 const names=[['rooms','tabChats','Your rooms'],['personal','tabFriends','Personal rooms'],['faction','globe','Faction rooms'],['settings','settings','Rooms settings']];
 let current='rooms';
 const draw=()=>root.replaceChildren(...names.flatMap(([name,ic,label],i)=>[h('button',{type:'button',role:'tab',title:label,'aria-label':label,'aria-selected':String(current===name),c:cx('root___FDeLd',current===name&&'selected___f9h6Z'),on:{click:()=>{current=name;draw();onTab(name);}}},icon(ic as any,'icon___mLyRZ')),i<names.length-1?h('div',{c:'divider___yq6Xu'}):null]).filter(Boolean));root.addEventListener('slink-room-tab',(e:CustomEvent)=>{current=e.detail;draw();});draw();return root;
}
export function mountPanel(root:ShadowRoot,opts:any){
 const style=h('style',{},css),panel=h('div',{c:'root___Ex8tg root___IOJWq tr-panel tr-colored window'});
 const title=text('headingH1','overflow___E0zcf title___ptIMK',{'data-window-title':'',style:'color:white'},'SLINK Rooms');
 const heading=h('div',{c:'actionButton___CPUK5 enabled___Zme4G',role:'button',tabindex:'0','data-room-info':'','aria-label':'Room information','aria-expanded':'false'},h('span',{'data-header-icon':''},opts.child?roomIcon('group','icon___MBR1e'):icon('chats','icon___MBR1e')),title,opts.child?icon('arrow','icon___MBR1e arrowIcon___RgJFw'):null);
 const minimize=icon('minimize','icon___MBR1e minimizeIcon___Bk5cS','Minimize faction rooms');minimize.dataset.close='';
 const close=icon('closeChat','icon___MBR1e closeIcon___s4Gjc','Close room');close.dataset.closeRoom='';close.setAttribute('title','Close room');if(!opts.child)close.setAttribute('hidden','');
 const header=h('div',{c:'root___zZRe1 root___rnQAo header___cccSy'},heading,h('button',{type:'button',c:'slink-media-button','data-gifs':'',title:'Search GIFs'},'GIF'),h('button',{type:'button',c:'slink-media-button','data-stickers':'',title:'Search stickers'},'Sticker'),minimize,opts.child?close:null);
 if(!opts.child){header.className=cx('root___zZRe1 root___tQsxi');heading.className=cx('textContainer___yU28H');heading.removeAttribute('data-room-info');heading.removeAttribute('role');heading.removeAttribute('tabindex');title.textContent='SLINK Rooms';}
 const home=icon('chats','icon___MBR1e','Room list');home.dataset.home='';home.hidden=true;
 const admin=icon('settings','icon___MBR1e','Manage rooms');admin.dataset.admin='';admin.hidden=true;
 // The bridge expects stable controls in every window; child-only controls remain hidden in the hub.
 if(!opts.child){close.hidden=true;header.append(close);for(const s of ['[data-gifs]','[data-stickers]'])header.querySelector<HTMLElement>(s)!.hidden=true;const info=h('span',{'data-room-info':'',hidden:true});header.append(info);}
 header.append(home,admin);
 const minimizeClick=()=>minimize.dispatchEvent(new MouseEvent('click',{bubbles:true}));
 header.addEventListener('click',e=>{if(e.target===header||(!opts.child&&heading.contains(e.target as Node)))minimizeClick();});
 for(const control of [minimize,close,home,admin,heading])control.addEventListener('keydown',(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();control.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
 const search=textInput({placeholder:'Search your rooms',icon:'search'});search.input.type='search';search.input.dataset.roomSearch='';search.input.setAttribute('aria-label','Search your rooms');
 const personal=h('section',{'data-personal-rooms':''}),roomList=h('div',{c:'tr-list','data-rooms':''}),settings=h('div',{c:'slink-room-settings','data-hub-settings':'',hidden:true});
 const sound=checkbox('Notification sounds',true,()=>{});sound.input.dataset.roomSound='';
 settings.append(setting('Notifications',[sound.label]),setting('Rooms',[actionButton('tabRecent','Refresh rooms',()=>{})]),setting('Room management',[actionButton('settings','Manage rooms',()=>{})]),text('body','',{},'UI by Manuel [3747263] — Torn Rooms. SLINK services and permissions.'));
 settings.querySelectorAll('button')[0].dataset.refresh='';settings.querySelectorAll('button')[1].dataset.hubManage='';
 const roomScroll=h('div',{c:'root___nbZIu tr-scroll','data-room-list-scroll':''},personal,roomList);
 const directory=h('div',{c:'content___SMWAe','data-home-view':''},tabs(opts.onTab),h('div',{c:'root___wDVPW root___TNYGW','data-search-slot':''},search.root),roomScroll,settings);
 const scroller=h('div',{c:'scrollWrapper___DmIrl','data-scroller':''},h('ol',{'data-messages':''}),h('div',{c:'pending','data-pending':''}),h('div',{c:'footer___QxkWe slink-chat-footer','data-room-status':''}));
 // Adapted RoomPanel.renderHeader options, routed to SLINK actions.
 const option=(ic:string,label:string,attribute:string)=>h('button',{type:'button',c:'root___Lrh0J',[attribute]:''},icon(ic as any,'icon___DbWGg'),text('subtitle','title___oY9So',{},label));
 const details=h('div',{c:'optionsContainer___CpJ5q','data-room-details':'',hidden:true},h('p',{style:'margin:8px;overflow-wrap:anywhere','data-room-description':''}),option('refresh','Reconnect','data-reconnect'),option('up','Earlier messages','data-older'),option('settings','Room settings','data-room-manage'));
 const draft=h('textarea',{c:'textarea___JRbO5','data-draft':'',maxlength:4096,rows:1,placeholder:'Type your message here...','aria-label':'Room message'});
 const compose=h('div',{c:'root___aBCjE'},draft,h('button',{type:'button',c:'iconWrapper___DRSkm','data-send':'','aria-label':'Send',title:'Send'},icon('send','icon___mMNXf')));
 const chat=h('div',{c:'content___aMpKJ','data-chat-view':'',hidden:true},details,h('div',{c:'root___v2RvA'},scroller),h('div',{c:'reply','data-reply':'',hidden:true}),h('button',{type:'button',c:'torn-btn','data-cancel-reply':'',hidden:true},'Cancel reply/edit'),compose);
 const media=h('div',{c:'content___aMpKJ','data-media-view':'',hidden:true},h('button',{type:'button',c:'torn-btn','data-media-back':''},'Back to room'),h('div',{c:'media-surface','data-media':''}));
 const notice=h('p',{c:'notice','data-notice':'',role:'status',hidden:true});
 panel.append(h('div',{c:'root___RdBC0'},header),notice,directory,chat,media,h('div',{'data-admin-view':'',hidden:true}));root.replaceChildren(style,panel);
}
// Adapted RoomPanel.message: SLINK attaches delivery, media and moderation handlers.
export function message(name:string,id:number,mine:boolean){
 const profile=text('link2','hrefLink___9O1GI sender___WTwPl regular___hyk3H clickable___efRv1',{href:'https://www.torn.com/profiles.php?XID='+id,target:'_blank',rel:'noopener noreferrer'},name+':');
 const meta=h('span',{c:'senderContainer___aAlZ2 meta'},profile),body=h('span',{c:'root___XpplE body___HxuJg message___AI7Nl'},h('span',{c:'root___RoNAh text'}));
 const box=h('div',{c:'box___eWW6m'},meta,body),bubble=h('div',{c:cx('root___EP_Dq first___icNlg',mine&&'self___HgXOK')},box),row=h('li',{c:'virtualItem___eIUjo message',style:'margin-bottom:5px'},bubble);
 return {row,meta,profile,body:body.firstChild as HTMLElement,box};
}
const roomPalettes:Record<string,{background:string,art?:string}>={
 'slinky-pursuit':{background:'linear-gradient(145deg,#142d43,#0c1722)'},
 'slinky-underglow':{background:'radial-gradient(ellipse at bottom,#51276e,#10243a 65%,#121021)'},
 'slinky-black-chrome':{background:'linear-gradient(145deg,#32383e,#14171c 45%,#222831)'},
 'halloween-2026':{background:'linear-gradient(#150b24aa,#100b18bf)',art:'halloween-2026-haunted-background-v1.webp'},
 'slink-naughty-list':{background:'linear-gradient(#180c14aa,#180d18bf)',art:'christmas2026-background.webp'},
 'slink-candy-cartel':{background:'linear-gradient(#261335aa,#190d22bf)',art:'candy-cartel-background.webp'}
};
export function look(panel:HTMLElement,look:any){
 panel.classList.toggle('tr-colored',!!look.color);panel.style.setProperty('--tr-room',look.color||'#20516d');
 const slot=panel.querySelector('[data-header-icon]');if(slot&&(slot as HTMLElement).dataset.icon!==look.icon){slot.replaceChildren(roomIcon(look.icon,'icon___MBR1e'));(slot as HTMLElement).dataset.icon=look.icon;}
 const theme=Object.hasOwn(roomPalettes,look.theme)?look.theme:'';
 if((panel.dataset.roomTheme||'')!==theme){
   if(theme){const palette=roomPalettes[theme];panel.dataset.roomTheme=theme;panel.style.setProperty('--tr-room-background',palette.background+(palette.art?', url("'+themeAsset(palette.art)+'"), #161019':''));}
   else {delete panel.dataset.roomTheme;panel.style.removeProperty('--tr-room-background');}
 }
}
