import{r as l,j as p,g as y,d as v}from"./index-JSp7Ugb5.js";/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=t=>t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),f=(...t)=>t.filter((e,r,n)=>!!e&&e.trim()!==""&&n.indexOf(e)===r).join(" ").trim();/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var j={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=l.forwardRef(({color:t="currentColor",size:e=24,strokeWidth:r=2,absoluteStrokeWidth:n,className:a="",children:i,iconNode:c,...d},o)=>l.createElement("svg",{ref:o,...j,width:e,height:e,stroke:t,strokeWidth:n?Number(r)*24/Number(e):r,className:f("lucide",a),...d},[...c.map(([u,x])=>l.createElement(u,x)),...Array.isArray(i)?i:[i]]));/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=(t,e)=>{const r=l.forwardRef(({className:n,...a},i)=>l.createElement(C,{ref:i,iconNode:e,className:f(`lucide-${_(t)}`,n),...a}));return r.displayName=`${t}`,r},N={primary:"text-white bg-gradient-to-br from-brand-500 to-brand-700 shadow-[0_10px_30px_-8px_rgba(63,102,240,0.55)] hover:shadow-[0_16px_40px_-8px_rgba(63,102,240,0.7)]",peach:"text-white bg-gradient-to-br from-peach-400 to-peach-600 shadow-[0_10px_30px_-8px_rgba(234,92,29,0.5)] hover:shadow-[0_16px_40px_-8px_rgba(234,92,29,0.65)]",glass:"text-ink glass-strong hover:bg-white/90",ghost:"text-ink-soft hover:text-ink hover:bg-white/60"},k={sm:"h-9 px-4 text-[13px] gap-1.5 rounded-xl",md:"h-11 px-5 text-sm gap-2 rounded-2xl",lg:"h-[52px] px-7 text-[15px] gap-2.5 rounded-2xl"};function z({children:t,variant:e="primary",size:r="md",className:n,onClick:a,type:i="button",icon:c,iconRight:d,disabled:o=!1}){const[u,x]=l.useState([]),b=s=>{if(o)return;const g=s.currentTarget.getBoundingClientRect(),m=Date.now();x(h=>[...h,{id:m,x:s.clientX-g.left,y:s.clientY-g.top}]),setTimeout(()=>x(h=>h.filter(w=>w.id!==m)),650),a==null||a(s)};return p.jsxs(y.button,{type:i,onClick:b,disabled:o,whileHover:o?void 0:{y:-2},whileTap:o?void 0:{scale:.97},transition:{type:"spring",stiffness:400,damping:22},className:v("relative inline-flex select-none items-center justify-center overflow-hidden font-semibold","transition-colors duration-300",N[e],k[r],o&&"cursor-not-allowed opacity-40 shadow-none",n),children:[c&&p.jsx("span",{className:"relative z-10 -ml-0.5 inline-flex",children:c}),p.jsx("span",{className:"relative z-10",children:t}),d&&p.jsx("span",{className:"relative z-10 -mr-0.5 inline-flex",children:d}),u.map(s=>p.jsx("span",{className:"pointer-events-none absolute z-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-[ripple_0.65s_ease-out] rounded-full bg-white/40",style:{left:s.x,top:s.y}},s.id))]})}const A={type:"spring",stiffness:220,damping:30,mass:.9},B={hidden:{opacity:0,y:26,filter:"blur(10px)"},visible:{opacity:1,y:0,filter:"blur(0px)",transition:{duration:.7,ease:[.22,1,.36,1]}}},R=(t=.09,e=0)=>({hidden:{},visible:{transition:{staggerChildren:t,delayChildren:e}}}),$={hidden:{opacity:0,y:18},visible:{opacity:1,y:0,transition:{duration:.6,ease:[.22,1,.36,1]}}},I={hidden:{opacity:0,scale:.94,filter:"blur(8px)"},visible:{opacity:1,scale:1,filter:"blur(0px)",transition:{duration:.7,ease:[.22,1,.36,1]}}};export{z as L,I as a,A as b,E as c,$ as f,B as r,R as s};
