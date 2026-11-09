export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Embeddable website widget JS.
 * Usage on any external site:
 *   <script src="https://your-domain.com/api/v1/public/chat/PUBLIC_KEY/widget.js"></script>
 * It renders a floating chat bubble styled inline (no deps) and calls
 * POST /api/v1/public/chat/PUBLIC_KEY for RAG answers.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { publicKey: string } }
) {
  const bot = await prisma.chatbot.findUnique({ where: { publicKey: params.publicKey } });
  if (!bot || bot.status !== "active") {
    return new NextResponse("// chatbot not found or inactive", {
      status: 404,
      headers: { "Content-Type": "application/javascript" },
    });
  }
  const settings = (bot.settings ?? {}) as Record<string, any>;
  const name = bot.name.replace(/</g, "&lt;");
  const welcome = String(settings.welcomeMessage ?? `Hi! I'm ${bot.name}. Ask me about our services.`).replace(/</g, "&lt;");
  const origin = _req.headers.get("origin") ?? "";

  const js = `;(function(){
var KEY=${JSON.stringify(params.publicKey)};
var ORIGIN=${JSON.stringify(origin || "")};
var NAME=${JSON.stringify(name)};
var WELCOME=${JSON.stringify(welcome)};
var cur=[];
var box=document.createElement("div");
box.id="aileadgen-chat";
box.style.cssText="position:fixed;bottom:20px;right:20px;z-index:99999;font-family:system-ui,sans-serif";
box.innerHTML=
'<button id="aileadgen-btn" style="width:52px;height:52px;border-radius:9999px;border:none;background:linear-gradient(135deg,#6366f1,#22d3ee);color:#fff;font-size:22px;cursor:pointer;box-shadow:0 10px 25px rgba(99,102,241,.5)">💬</button>'+
'<div id="aileadgen-panel" style="display:none;position:absolute;bottom:60px;right:0;width:330px;max-width:88vw;height:420px;background:#0b1020;color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,.5)">'+
'<div style="padding:12px;border-bottom:1px solid rgba(255,255,255,.1)"><strong>'+NAME+'</strong><div style="font-size:11px;opacity:.6">AI Assistant</div></div>'+
'<div id="aileadgen-msgs" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:1.5"></div>'+
'<form id="aileadgen-form" style="display:flex;gap:6px;padding:10px;border-top:1px solid rgba(255,255,255,.1)">'+
'<input id="aileadgen-input" placeholder="Type a message..." style="flex:1;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;padding:8px 10px;outline:none"/>'+
'<button style="background:linear-gradient(135deg,#6366f1,#22d3ee);border:none;color:#fff;border-radius:8px;padding:0 14px;cursor:pointer">Send</button></form></div>';
document.body.appendChild(box);
function addMsg(role, text){
var msgs=document.getElementById("aileadgen-msgs");
var d=document.createElement("div");
d.style.cssText=role==="user"?"align-self:flex-end;background:linear-gradient(135deg,#6366f1,#22d3ee);border-radius:12px 12px 4px 12px;padding:8px 10px;max-width:85%":"align-self:flex-start;background:rgba(255,255,255,.08);border-radius:12px 12px 12px 4px;padding:8px 10px;max-width:85%";
d.textContent=text;
msgs.appendChild(d); msgs.scrollTop=msgs.scrollHeight;
}
document.getElementById("aileadgen-btn").onclick=function(){
var p=document.getElementById("aileadgen-panel");
var open=p.style.display==="flex";
p.style.display=open?"none":"flex";
if(!open && !cur.length) addMsg("assistant",WELCOME);
};
document.getElementById("aileadgen-form").onsubmit=function(e){
e.preventDefault();
var inp=document.getElementById("aileadgen-input");
var text=inp.value.trim(); if(!text) return;
cur.push({role:"user",content:text}); addMsg("user",text); inp.value="";
addMsg("assistant","Thinking…");
var base=ORIGIN||window.location.origin;
fetch(base+"/api/v1/public/chat/"+KEY,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,history:cur.slice(-6)})})
.then(function(r){return r.json();}).then(function(d){
cur.push({role:"assistant",content:d.answer||"Sorry, try again."});
var msgs=document.getElementById("aileadgen-msgs");
msgs.lastChild.textContent=d.answer||"Sorry, try again.";
msgs.scrollTop=msgs.scrollHeight;
}).catch(function(){cur.pop(); var msgs=document.getElementById("aileadgen-msgs"); msgs.lastChild.textContent="Could not reach assistant.";});
};
})();`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300",
    },
  });
}
