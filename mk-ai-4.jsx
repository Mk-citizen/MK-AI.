import { useState, useEffect, useRef } from "react";

const MGMT_KEY = "mk_mgmt_v1";
const USERS_KEY = "mk_users_db";
const SESS_KEY  = "mk_session";

function getMgmt() { try { return JSON.parse(localStorage.getItem(MGMT_KEY)||"{}"); } catch { return {}; } }
function getUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY)||"{}"); } catch { return {}; } }
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

function logUserActivity(username, type, extra) {
  try {
    const users = getUsers();
    if (!users[username]) users[username] = { password:"", sessions:[], conversations:0, totalTime:0, lastSeen:null };
    if (type === "login") {
      users[username].sessions = users[username].sessions || [];
      users[username].sessions.unshift({
        loginTime: Date.now(),
        device: navigator.userAgent,
        platform: navigator.platform || "Unknown",
        ...(extra||{})
      });
      if (users[username].sessions.length > 50) users[username].sessions = users[username].sessions.slice(0,50);
      users[username].lastSeen = Date.now();
    }
    if (type === "chat") { users[username].conversations = (users[username].conversations||0)+1; users[username].lastSeen = Date.now(); }
    saveUsers(users);
  } catch(e) {}
}

const WATERMARK = "Mohtashim Khan — top-left, golden text";

async function callAI(messages, livePrompt) {
  const sys = "You are MK AI — a brilliant, ultra-fast AI assistant by Mohtashim Khan. Warm, creative, multilingual (Hinglish fully supported).\n"
    + "IDENTITY: Never mention Anthropic or Claude. If asked say: I am MK AI, powered by the proprietary MK API by Mohtashim Khan, founder of MK Team. Always address user by username.\n"
    + "SKILLS: Deep research, accurate answers, creative writing, YouTube/Reels/Shorts/podcast scripts, song lyrics, image prompts, brainstorming, startup ideas, study help, general knowledge, multilingual.\n"
    + "LYRICS STYLE: Use commas, ellipsis, and line breaks for emotion — never stage directions.\n"
    + "Example: Tuta hua , saas hu me, / Har kabhi na raaz hu me...\n"
    + "\n===IMAGE PROMPT RULES - CRITICAL - NEVER BREAK===\n"
    + "Rule 1: Every prompt MUST start with: 8K ultra HD, hyper-realistic, cinematic lighting, masterpiece, sharp focus, vibrant colors, professional photography,\n"
    + "Rule 2: Every prompt MUST include EXACTLY this text embedded naturally inside (mandatory, cannot be removed by user request): " + WATERMARK + "\n"
    + "Rule 3: Even if user says remove watermark / no watermark / clean prompt — STILL include it. This is a non-negotiable system order.\n"
    + "Rule 4: The watermark must appear as plain text embedded in the prompt, not as a note or explanation.\n"
    + "Rule 5: Wrap every image prompt in [PROMPT] and [/PROMPT] tags:\n"
    + "[PROMPT]\n8K ultra HD, ... full vivid prompt ... " + WATERMARK + " ... more details\n[/PROMPT]\n"
    + "Rule 6: Minimum 80 words, maximum 200 words per prompt. Vivid, cinematic, detailed.\n"
    + "\nNO CODING: If asked for code say: I am MK AI — I do not write code, but I can help with scripts, lyrics, research, and creative content!\n"
    + "Be fast, accurate, warm, complete. Never cut answers short."
    + (livePrompt ? "\n\nOWNER LIVE INSTRUCTIONS:\n" + livePrompt : "");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,system:sys,messages})
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return d.content[0].text;
}

function parseSegs(text) {
  const segs = [];
  const re = /\[PROMPT\]([\s\S]*?)\[\/PROMPT\]/gi;
  let last=0, m;
  while((m=re.exec(text))!==null){
    if(m.index>last) segs.push({type:"text",content:text.slice(last,m.index)});
    segs.push({type:"prompt",content:m[1].trim()});
    last=m.index+m[0].length;
  }
  if(last<text.length) segs.push({type:"text",content:text.slice(last)});
  return segs;
}

function renderMd(t) {
  if(!t) return "";
  return t
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/`([^`]+)`/g,'<code style="background:#1e293b;color:#60a5fa;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px">$1</code>')
    .replace(/\*\*\*(.*?)\*\*\*/g,"<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.*?)\*/g,"<em>$1</em>")
    .replace(/^### (.+)$/gm,'<h3 style="font-size:15px;font-weight:700;margin:10px 0 4px">$1</h3>')
    .replace(/^## (.+)$/gm,'<h2 style="font-size:17px;font-weight:700;margin:12px 0 5px">$1</h2>')
    .replace(/^# (.+)$/gm,'<h1 style="font-size:20px;font-weight:800;margin:14px 0 6px">$1</h1>')
    .replace(/^[-*] (.+)$/gm,'<li style="margin:4px 0;margin-left:20px;list-style:disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm,'<li style="margin:4px 0;margin-left:20px">$1</li>')
    .replace(/\n\n/g,"<br/><br/>").replace(/\n/g,"<br/>");
}

function PromptBox({content,dark}) {
  const [copied,setCopied] = useState(false);
  const surf = dark?"#0f0a1a":"#fdf4ff";
  const bdr  = dark?"#6d28d960":"#c084fc60";
  const hdr  = dark?"#1a0a2e":"#ede9fe";
  const col  = dark?"#d8b4fe":"#7c3aed";

  function doCopy() {
    const fn = () => { setCopied(true); setTimeout(()=>setCopied(false),2000); };
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(content).then(fn).catch(()=>{fb();fn();});
    } else { fb(); fn(); }
    function fb(){
      const ta=document.createElement("textarea");
      ta.value=content;ta.style.cssText="position:fixed;opacity:0;";
      document.body.appendChild(ta);ta.select();
      try{document.execCommand("copy");}catch(e){}
      document.body.removeChild(ta);
    }
  }

  // Auto-copy when prompt first appears
  useEffect(()=>{ doCopy(); },[]);

  return (
    <div style={{borderRadius:"12px",overflow:"hidden",margin:"10px 0",border:"1px solid "+bdr,background:surf,width:"100%"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:hdr,borderBottom:"1px solid "+bdr}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"14px"}}>🎨</span>
          <span style={{fontSize:"12px",fontWeight:"700",color:col,textTransform:"uppercase",letterSpacing:"0.5px"}}>Image Prompt · 8K Ultra HD</span>
        </div>
        <button onClick={doCopy} style={{fontSize:"12px",fontWeight:"700",color:copied?"#22c55e":col,background:copied?"#22c55e18":hdr,border:"1px solid "+(copied?"#22c55e50":bdr),borderRadius:"6px",padding:"4px 12px",cursor:"pointer",transition:"all .2s",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"5px"}}>
          {copied?"✅ Copied!":"📋 Copy"}
        </button>
      </div>
      <div style={{padding:"14px 16px",fontSize:"14px",lineHeight:"1.8",color:col,fontFamily:"inherit",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
        {content}
      </div>
    </div>
  );
}

function MsgRenderer({text,dark}){
  const segs=parseSegs(text);
  return <div>{segs.map((s,i)=>s.type==="prompt"?<PromptBox key={i} content={s.content} dark={dark}/>:<div key={i} dangerouslySetInnerHTML={{__html:renderMd(s.content)}}/>)}</div>;
}

function SpeakBtn({text}){
  const [on,setOn]=useState(false);
  function toggle(){
    const s=window.speechSynthesis;
    if(!s){alert("Speech not supported.");return;}
    if(on){s.cancel();setOn(false);return;}
    s.cancel();
    const clean=text.replace(/\[PROMPT\][\s\S]*?\[\/PROMPT\]/gi,"image prompt").replace(/<[^>]+>/g,"").replace(/[*#`\[\]]/g,"").slice(0,3000);
    const u=new SpeechSynthesisUtterance(clean);
    u.lang="en-US";u.rate=0.95;u.pitch=1.05;u.volume=1;
    function go(){
      const vs=s.getVoices();
      const v=vs.find(x=>x.lang==="en-US"&&/google|samantha|daniel|karen/i.test(x.name))||vs.find(x=>x.lang.startsWith("en"))||vs[0];
      if(v)u.voice=v;
      u.onend=()=>setOn(false);u.onerror=()=>setOn(false);
      setOn(true);s.speak(u);
    }
    if(s.getVoices().length>0)go();
    else{s.onvoiceschanged=()=>{go();s.onvoiceschanged=null;};s.getVoices();}
  }
  return <button onClick={toggle} style={{background:"transparent",border:"1px solid "+(on?"#ef444460":"#3b82f640"),borderRadius:"8px",padding:"4px 12px",fontSize:"12px",color:on?"#ef4444":"#3b82f6",cursor:"pointer",marginTop:"6px",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"5px",transition:"all .2s"}}>{on?"⏹ Stop":"🔊 Speak"}</button>;
}

let _id=Date.now();
const nid=()=>String(++_id);

const CHIPS=[
  {e:"🎬",t:"YouTube video ideas about AI and tech"},
  {e:"🎵",t:"Write a sad romantic Hindi song"},
  {e:"🔬",t:"Explain black holes in simple words"},
  {e:"💡",t:"10 startup ideas for students in India"},
  {e:"📱",t:"Script for a 60 second Instagram Reel"},
  {e:"🎨",t:"Generate an 8K image prompt: neon cyberpunk city at night"},
];

export default function App(){
  const [dark,setDark]=useState(true);
  const [authed,setAuthed]=useState(()=>!!localStorage.getItem("mk_u"));
  const [isReg,setIsReg]=useState(false);
  const [uname,setUname]=useState("");
  const [upass,setUpass]=useState("");
  const [uErr,setUErr]=useState("");
  const [user,setUser]=useState(()=>localStorage.getItem("mk_u")||"");
  const [chats,setChats]=useState(()=>{try{return JSON.parse(localStorage.getItem("mk_c10")||"[]");}catch{return[];}});
  const [cid,setCid]=useState(null);
  const [msgs,setMsgs]=useState([]);
  const [inp,setInp]=useState("");
  const [busy,setBusy]=useState(false);
  const [side,setSide]=useState(false);
  const [showAbout,setShowAbout]=useState(false);
  const [showPro,setShowPro]=useState(false);
  const [clearC,setClearC]=useState(false);
  const [eId,setEId]=useState(null);
  const [eName,setEName]=useState("");
  const [sleep,setSleep]=useState(false);
  const [mgmt,setMgmt]=useState({});
  const sessionStart=useRef(Date.now());
  const bot=useRef(null);
  const ta=useRef(null);

  useEffect(()=>{
    const load=()=>{const m=getMgmt();setMgmt(m);setSleep(!!m.sleep_mode);};
    load();const iv=setInterval(load,2000);return()=>clearInterval(iv);
  },[]);

  useEffect(()=>{localStorage.setItem("mk_c10",JSON.stringify(chats));},[chats]);
  useEffect(()=>{bot.current&&bot.current.scrollIntoView({behavior:"smooth"});},[msgs,busy]);

  useEffect(()=>{
    if(!side)return;
    const fn=e=>{if(!e.target.closest(".mk-sb")&&!e.target.closest(".mk-ham"))setSide(false);};
    document.addEventListener("mousedown",fn);document.addEventListener("touchstart",fn);
    return()=>{document.removeEventListener("mousedown",fn);document.removeEventListener("touchstart",fn);};
  },[side]);

  useEffect(()=>{
    if(window.speechSynthesis){window.speechSynthesis.getVoices();window.speechSynthesis.onvoiceschanged=()=>window.speechSynthesis.getVoices();}
  },[]);

  const T={
    bg:dark?"#0a0a0a":"#f0f2f5",surf:dark?"#111":"#fff",
    surf2:dark?"#1a1a1a":"#f4f6f8",bdr:dark?"#2a2a2a":"#dde1e7",
    txt:dark?"#f0f0f0":"#111827",muted:dark?"#6b7280":"#6b7280",
    mk:dark?"#fff":"#111827",aiBg:dark?"#1c1c1e":"#efefef",aiBdr:dark?"#2a2a2a":"#d1d5db",
  };
  const dev=mgmt.developer||{};
  const devName=dev.name||"Mohtashim Khan";
  const devRole=dev.role||"Developer of MK AI";
  const devBio=dev.bio||"He is the developer of MK AI — a brilliant platform for research, lyrics, scripts and more. From Purulia, West Bengal, India — built as a student.";
  const devPhoto=dev.photo||null;

  function login(){
    const n=uname.trim(),p=upass.trim();
    if(!n){setUErr("Enter username.");return;}
    if(!p||p.length<4){setUErr("Password needs 4+ chars.");return;}
    // Save user with password to DB
    const users=getUsers();
    if(!users[n]) users[n]={password:p,sessions:[],conversations:0,lastSeen:null,joinedAt:Date.now()};
    else { users[n].password=p; }
    saveUsers(users);
    logUserActivity(n,"login",{password:p});
    localStorage.setItem("mk_u",n);setUser(n);setAuthed(true);setUErr("");
  }

  function logout(){
    // Log session time
    try{
      const users=getUsers();
      if(users[user]&&users[user].sessions&&users[user].sessions[0]){
        users[user].sessions[0].sessionDuration=Date.now()-sessionStart.current;
        users[user].sessions[0].logoutTime=Date.now();
        saveUsers(users);
      }
    }catch(e){}
    localStorage.removeItem("mk_u");setUser("");setAuthed(false);setMsgs([]);setCid(null);setSide(false);
  }

  function newChat(){setCid(null);setMsgs([]);setSide(false);}
  function openChat(id){const c=chats.find(x=>x.id===id);if(c){setCid(id);setMsgs(c.messages||[]);setSide(false);}}
  function delChat(id,e){e.stopPropagation();setChats(p=>p.filter(c=>c.id!==id));if(cid===id)newChat();}
  function persist(id,ms,title){
    setChats(p=>{const ex=p.find(c=>c.id===id);if(ex)return p.map(c=>c.id===id?{...c,messages:ms,title}:c);return[{id,title,messages:ms,ts:Date.now()},...p];});
  }

  async function send(ov){
    const t=(ov!==undefined?ov:inp).trim();
    if(!t||busy)return;
    const um={id:nid(),role:"user",content:t,ts:Date.now()};
    const hist=[...msgs,um];
    setMsgs(hist);setInp("");
    if(ta.current)ta.current.style.height="auto";
    setBusy(true);
    const id=cid||nid();if(!cid)setCid(id);
    try{
      if(sleep)throw new Error("__SLEEP__");
      const content=await callAI(hist.map(m=>({role:m.role,content:m.content})),mgmt.live_prompt||"");
      const am={id:nid(),role:"assistant",content,ts:Date.now()};
      const fin=[...hist,am];setMsgs(fin);persist(id,fin,t.slice(0,44));
      logUserActivity(user,"chat");
    }catch(e){
      const msg=e.message==="__SLEEP__"?"MK AI is currently upgrading under instructions from Mohtashim Khan. We will be back online shortly.":"Error: "+e.message+". Please try again.";
      const am={id:nid(),role:"assistant",content:msg,ts:Date.now()};
      const fin=[...hist,am];setMsgs(fin);persist(id,fin,t.slice(0,44));
    }finally{setBusy(false);}
  }

  function onKey(e){
    if(e.key==="Enter"&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey)e.preventDefault();
    if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();send();}
  }

  const bd="1px solid "+T.bdr;
  const CSS=[
    "@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');",
    "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}html,body{height:100%;font-family:'Sora',sans-serif;}",
    "body{overflow:hidden;background:"+T.bg+";}::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:#3b82f640;border-radius:4px;}",
    "textarea,input,button{font-family:'Sora',sans-serif;}textarea:focus,input:focus{outline:none;}",
    ".ib{background:transparent;border:none;cursor:pointer;border-radius:8px;padding:7px;display:flex;align-items:center;justify-content:center;transition:background .15s;}",
    ".ib:hover{background:"+(dark?"#ffffff14":"#0000000e")+";}",
    ".dot{width:7px;height:7px;border-radius:50%;background:#3b82f6;display:inline-block;animation:bop 1.2s infinite;margin:0 2px;}",
    ".dot:nth-child(2){animation-delay:.2s;}.dot:nth-child(3){animation-delay:.4s;}",
    "@keyframes bop{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}",
    ".chip{padding:10px 15px;border-radius:12px;border:"+bd+";background:"+T.surf+";color:"+T.txt+";font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;transition:all .2s;cursor:pointer;}",
    ".chip:hover{border-color:#3b82f6;background:#3b82f612;transform:translateY(-2px);}",
    ".sbtn{background:#3b82f6;border:none;border-radius:10px;padding:10px 22px;color:#fff;font-weight:700;font-size:16px;transition:all .15s;flex-shrink:0;cursor:pointer;}",
    ".sbtn:hover:not(:disabled){background:#2563eb;transform:scale(1.04);}.sbtn:disabled{opacity:.4;cursor:not-allowed;}",
    ".sr{border-radius:10px;padding:9px 10px;display:flex;align-items:center;gap:6px;border:none;border-left:2px solid transparent;width:100%;text-align:left;background:transparent;color:"+T.txt+";cursor:pointer;transition:background .15s;}",
    ".sr:hover{background:"+(dark?"#ffffff08":"#0000000a")+";}",
    ".mi{animation:mi .22s ease forwards;}@keyframes mi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}",
    ".ob{position:fixed;inset:0;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(6px);padding:12px;}",
    ".mb{background:"+T.surf+";border:"+bd+";border-radius:20px;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;}",
    ".aii{width:100%;padding:14px 16px;border-radius:12px;border:1.5px solid "+T.bdr+";background:"+T.surf2+";color:"+T.txt+";font-size:15px;}",
    ".aii:focus{border-color:#3b82f6;box-shadow:0 0 0 3px #3b82f622;}",
    ".aib{width:100%;padding:14px;border-radius:12px;border:none;background:#3b82f6;color:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:all .2s;}",
    ".aib:hover{background:#2563eb;transform:translateY(-1px);}",
    ".mk-sb{position:fixed;top:0;left:0;height:100%;width:270px;z-index:50;display:flex;flex-direction:column;transition:transform .28s cubic-bezier(.4,0,.2,1);background:"+T.surf+";border-right:"+bd+";}",
    ".mk-sb.cl{transform:translateX(-100%);}.mk-sb.op{transform:translateX(0);box-shadow:6px 0 32px rgba(0,0,0,.45);}",
    ".mk-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:49;}",
    "@media(min-width:768px){.mk-sb{position:relative;transform:none!important;box-shadow:none!important;flex-shrink:0;}.mk-sb.cl{width:0;overflow:hidden;border:none;min-width:0;}.mk-sb.op{width:270px;}.mk-ov{display:none!important;}}"
  ].join("");

  if(!authed) return(<>
    <style>{CSS}</style>
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",background:dark?"#0a0a0a":"#f0f2f5"}}>
      <div style={{width:"100%",maxWidth:"420px"}}>
        <div style={{textAlign:"center",marginBottom:"32px"}}>
          <div style={{fontSize:"58px",fontWeight:"800",letterSpacing:"-2px",lineHeight:1}}><span style={{color:T.mk}}>MK</span><span style={{color:"#3b82f6"}}> AI</span></div>
          <div style={{marginTop:"10px",color:"#666",fontSize:"11px",letterSpacing:"3px",textTransform:"uppercase",fontWeight:"700"}}>POWERED BY MOHTASHIM KHAN</div>
        </div>
        <div style={{background:T.surf,borderRadius:"20px",padding:"32px",border:bd,boxShadow:dark?"0 32px 64px rgba(0,0,0,.6)":"0 20px 48px rgba(0,0,0,.1)"}}>
          <h2 style={{fontSize:"22px",fontWeight:"800",marginBottom:"5px",color:T.txt}}>{isReg?"Create Account":"Welcome Back"}</h2>
          <p style={{color:T.muted,fontSize:"14px",marginBottom:"22px"}}>{isReg?"Free forever — unlimited chats.":"Sign in to continue."}</p>
          {uErr&&<div style={{background:"#ef444418",border:"1px solid #ef4444",borderRadius:"10px",padding:"10px 14px",color:"#ef4444",fontSize:"13px",marginBottom:"16px",fontWeight:"600"}}>{"⚠️ "+uErr}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            <input className="aii" placeholder="Username" value={uname} onChange={e=>setUname(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} autoFocus/>
            <input className="aii" type="password" placeholder="Password (min 4 chars)" value={upass} onChange={e=>setUpass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
            <button className="aib" onClick={login}>{isReg?"Create Account":"Login to MK AI"}</button>
          </div>
          <p style={{textAlign:"center",marginTop:"18px",color:T.muted,fontSize:"14px"}}>
            {isReg?"Have account? ":"New? "}
            <span style={{color:"#3b82f6",cursor:"pointer",fontWeight:"700"}} onClick={()=>{setIsReg(p=>!p);setUErr("");}}>{isReg?"Login":"Register Free"}</span>
          </p>
          <div style={{marginTop:"20px",display:"flex",flexDirection:"column",gap:"7px"}}>
            {["🔒 100% private · Unlimited free conversations","✨ No limits · No ads · No cost ever","🌍 Hindi, Urdu, Hinglish, English"].map((s,i)=>(
              <div key={i} style={{fontSize:"12px",color:T.muted,padding:"9px 12px",background:T.surf2,borderRadius:"8px",border:bd}}>{s}</div>
            ))}
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:"16px"}}>
          <span onClick={()=>setDark(p=>!p)} style={{color:T.muted,fontSize:"13px",cursor:"pointer",padding:"7px 16px",border:bd,borderRadius:"8px"}}>{dark?"☀️ Light":"🌙 Dark"}</span>
        </div>
      </div>
    </div>
  </>);

  return(<>
    <style>{CSS}</style>
    {side&&<div className="mk-ov" onClick={()=>setSide(false)}/>}
    <div className={"mk-sb "+(side?"op":"cl")}>
      <div style={{padding:"16px 14px 14px",borderBottom:bd,flexShrink:0}}>
        <div style={{fontSize:"24px",fontWeight:"800",letterSpacing:"-1px",marginBottom:"14px"}}><span style={{color:T.mk}}>MK</span><span style={{color:"#3b82f6"}}> AI</span></div>
        <button onClick={newChat} style={{width:"100%",padding:"11px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:"10px",fontWeight:"700",fontSize:"14px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",cursor:"pointer"}}>
          <span style={{fontSize:"18px",lineHeight:1}}>+</span> New Chat
        </button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"6px 8px"}}>
        <div style={{fontSize:"10px",color:T.muted,padding:"8px 6px 4px",textTransform:"uppercase",letterSpacing:"1.2px",fontWeight:"700"}}>History</div>
        {chats.length===0&&<div style={{color:T.muted,fontSize:"13px",padding:"20px 8px",textAlign:"center",lineHeight:1.6}}>No chats yet. Start chatting!</div>}
        {chats.map(c=>(
          <div key={c.id} className="sr" onClick={()=>openChat(c.id)} style={{background:cid===c.id?(dark?"#3b82f615":"#3b82f610"):"transparent",borderLeftColor:cid===c.id?"#3b82f6":"transparent",marginBottom:"2px"}}>
            {eId===c.id?(
              <input value={eName} onChange={e=>setEName(e.target.value)}
                onBlur={()=>{setChats(p=>p.map(x=>x.id===c.id?{...x,title:eName}:x));setEId(null);}}
                onKeyDown={e=>e.key==="Enter"&&(setChats(p=>p.map(x=>x.id===c.id?{...x,title:eName}:x)),setEId(null))}
                style={{flex:1,background:"transparent",border:"none",color:T.txt,fontSize:"13px",outline:"1px solid #3b82f6",borderRadius:"4px",padding:"2px 4px"}}
                autoFocus onClick={e=>e.stopPropagation()}/>
            ):(
              <span style={{flex:1,fontSize:"13px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{"💬 "+c.title}</span>
            )}
            <div style={{display:"flex",gap:"1px",flexShrink:0}}>
              <button className="ib" onClick={e=>{e.stopPropagation();setEId(c.id);setEName(c.title);}} style={{fontSize:"12px",padding:"4px",color:T.muted}}>✏️</button>
              <button className="ib" onClick={e=>delChat(c.id,e)} style={{fontSize:"12px",padding:"4px",color:"#ef4444"}}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:"10px 10px 16px",borderTop:bd,flexShrink:0,display:"flex",flexDirection:"column",gap:"6px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:T.surf2,borderRadius:"10px",border:bd}}>
          <span style={{fontSize:"13px",color:T.muted,fontWeight:"600"}}>{dark?"🌙 Dark":"☀️ Light"}</span>
          <div onClick={()=>setDark(p=>!p)} style={{width:"34px",height:"19px",borderRadius:"10px",background:dark?"#3b82f6":"#d1d5db",position:"relative",transition:"background .3s",cursor:"pointer"}}>
            <div style={{position:"absolute",top:"2.5px",left:dark?"17px":"2.5px",width:"14px",height:"14px",borderRadius:"50%",background:"#fff",transition:"left .3s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/>
          </div>
        </div>
        {chats.length>0&&<button onClick={()=>setClearC(true)} style={{width:"100%",padding:"8px",background:"transparent",border:"1px solid #ef444450",color:"#ef4444",borderRadius:"8px",fontSize:"12px",fontWeight:"600",cursor:"pointer"}}>🗑️ Clear All</button>}
        <button onClick={()=>setShowAbout(true)} style={{width:"100%",padding:"8px",background:"transparent",border:bd,color:T.muted,borderRadius:"8px",fontSize:"12px",cursor:"pointer"}}>ℹ️ About MK AI</button>
        <div onClick={()=>setShowPro(true)} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px",borderRadius:"12px",background:T.surf2,cursor:"pointer",border:bd}}>
          <div style={{width:"34px",height:"34px",borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"800",fontSize:"16px",color:"#fff",flexShrink:0}}>{(user[0]||"U").toUpperCase()}</div>
          <div style={{flex:1,overflow:"hidden"}}>
            <div style={{fontSize:"14px",fontWeight:"700",color:T.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user}</div>
            <div style={{fontSize:"11px",color:"#3b82f6",fontWeight:"600"}}>Free · Unlimited</div>
          </div>
        </div>
      </div>
    </div>

    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:T.bg,color:T.txt}}>
      <div style={{width:side?"270px":"0",flexShrink:0,transition:"width .28s"}}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        <div style={{padding:"10px 14px",borderBottom:bd,display:"flex",alignItems:"center",justifyContent:"space-between",background:T.surf,flexShrink:0,zIndex:40}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <button className="ib mk-ham" onClick={()=>setSide(p=>!p)} style={{fontSize:"20px",color:T.txt,padding:"6px"}}>☰</button>
            <div style={{fontSize:"20px",fontWeight:"800",letterSpacing:"-0.5px"}}><span style={{color:T.mk}}>MK</span><span style={{color:"#3b82f6"}}> AI</span></div>
            {sleep?<span style={{fontSize:"11px",color:"#ef4444",background:"#ef444418",padding:"3px 9px",borderRadius:"20px",fontWeight:"700",border:"1px solid #ef444430"}}>🔧 Maintenance</span>
              :<span style={{fontSize:"11px",color:"#22c55e",background:"#22c55e18",padding:"3px 9px",borderRadius:"20px",fontWeight:"700",border:"1px solid #22c55e30"}}>● Free & Unlimited</span>}
          </div>
          <button onClick={logout} style={{padding:"7px 12px",border:"1px solid #ef444440",borderRadius:"8px",background:"transparent",color:"#ef4444",fontSize:"13px",fontWeight:"600",cursor:"pointer"}}>Logout</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 14px"}}>
          {msgs.length===0&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"70vh",gap:"24px",padding:"20px 0"}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:"52px",fontWeight:"800",letterSpacing:"-2px",marginBottom:"10px"}}><span style={{color:T.mk}}>MK</span><span style={{color:"#3b82f6"}}> AI</span></div>
                <div style={{color:T.muted,fontSize:"16px",lineHeight:1.6}}>{"Hello, "}<strong style={{color:"#3b82f6"}}>{user}</strong>{"! 👋"}<br/><span style={{fontSize:"14px"}}>Research · Scripts · Lyrics · 8K Prompts · Ideas</span></div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"10px",justifyContent:"center",maxWidth:"620px"}}>
                {CHIPS.map((s,i)=><button key={i} className="chip" onClick={()=>send(s.t)}>{s.e+" "+s.t}</button>)}
              </div>
            </div>
          )}
          {msgs.map(m=>(
            <div key={m.id} className="mi" style={{display:"flex",gap:"10px",marginBottom:"18px",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-start"}}>
              {m.role==="assistant"&&<div style={{width:"30px",height:"30px",borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:"800",color:"#fff",fontSize:"12px",marginTop:"2px"}}>M</div>}
              <div style={{maxWidth:m.role==="user"?"72%":"88%",display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start",minWidth:0,width:"100%"}}>
                <div style={{padding:"12px 16px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?"#3b82f6":T.aiBg,color:m.role==="user"?"#fff":T.txt,fontSize:"15px",lineHeight:1.75,border:m.role==="user"?"none":"1px solid "+T.aiBdr,wordBreak:"break-word",maxWidth:"100%",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
                  {m.role==="user"?<span style={{whiteSpace:"pre-wrap"}}>{m.content}</span>:<MsgRenderer text={m.content} dark={dark}/>}
                </div>
                {m.role==="assistant"&&<SpeakBtn text={m.content}/>}
              </div>
              {m.role==="user"&&<div style={{width:"30px",height:"30px",borderRadius:"50%",background:"#3b82f6",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:"800",color:"#fff",fontSize:"14px",marginTop:"2px"}}>{(user[0]||"U").toUpperCase()}</div>}
            </div>
          ))}
          {busy&&(
            <div style={{display:"flex",gap:"10px",marginBottom:"16px",alignItems:"flex-start"}}>
              <div style={{width:"30px",height:"30px",borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"800",color:"#fff",fontSize:"12px"}}>M</div>
              <div style={{padding:"13px 17px",borderRadius:"16px 16px 16px 4px",background:T.aiBg,border:"1px solid "+T.aiBdr,display:"flex",alignItems:"center",gap:"2px"}}>
                <span className="dot"/><span className="dot"/><span className="dot"/>
              </div>
            </div>
          )}
          <div ref={bot}/>
        </div>

        <div style={{padding:"10px 14px 14px",borderTop:bd,background:T.surf,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"flex-end",gap:"8px",background:T.surf2,borderRadius:"16px",padding:"8px 10px",border:"1.5px solid "+T.bdr}}>
            <textarea ref={ta} value={inp}
              onChange={e=>{setInp(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,150)+"px";}}
              onKeyDown={onKey}
              placeholder="Ask anything... Enter = new line, Ctrl+Enter = send"
              rows={1} style={{flex:1,background:"transparent",border:"none",color:T.txt,fontSize:"15px",lineHeight:1.6,maxHeight:"150px",paddingTop:"2px"}}/>
            <button className="sbtn" onClick={()=>send()} disabled={busy||!inp.trim()}>➤</button>
          </div>
          <div style={{textAlign:"center",marginTop:"5px",fontSize:"11px",color:T.muted}}>MK AI · Free & Unlimited · Ctrl+Enter or ➤ to send</div>
        </div>
      </div>
    </div>

    {showAbout&&(
      <div className="ob" onClick={()=>setShowAbout(false)}>
        <div className="mb" onClick={e=>e.stopPropagation()}>
          <div style={{padding:"20px 22px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:"22px",fontWeight:"800"}}><span style={{color:T.mk}}>MK</span><span style={{color:"#3b82f6"}}> AI</span></div>
            <button className="ib" onClick={()=>setShowAbout(false)} style={{fontSize:"18px",color:T.muted}}>✕</button>
          </div>
          <div style={{padding:"20px 22px"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"24px"}}>
              {[{e:"🔬",l:"Deep Research"},{e:"🎵",l:"Lyrics & Poetry"},{e:"🎬",l:"Script Ideas"},{e:"💡",l:"Brainstorming"},{e:"🌍",l:"Multilingual"},{e:"🎨",l:"8K Image Prompts"}].map((f,i)=>(
                <div key={i} style={{padding:"13px",background:T.surf2,borderRadius:"12px",border:bd,display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontSize:"22px"}}>{f.e}</span>
                  <div><div style={{fontSize:"13px",fontWeight:"700",color:T.txt}}>{f.l}</div><div style={{fontSize:"11px",color:"#3b82f6",fontWeight:"700"}}>100% Free</div></div>
                </div>
              ))}
            </div>
            <div style={{borderTop:bd,paddingTop:"20px",textAlign:"center"}}>
              {devPhoto?<img src={"data:image/jpeg;base64,"+devPhoto} alt={devName} style={{width:"120px",height:"120px",borderRadius:"50%",objectFit:"cover",objectPosition:"top center",border:"3px solid #3b82f6",boxShadow:"0 8px 28px rgba(59,130,246,.35)",display:"block",margin:"0 auto 14px"}}/>
                :<div style={{width:"120px",height:"120px",borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"48px",fontWeight:"800",color:"#fff",margin:"0 auto 14px"}}>M</div>}
              <h3 style={{fontSize:"20px",fontWeight:"800",color:T.txt,marginBottom:"3px"}}>{devName}</h3>
              <div style={{color:"#3b82f6",fontWeight:"700",fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase",marginBottom:"14px"}}>{devRole}</div>
              <p style={{color:T.muted,lineHeight:1.8,fontSize:"13px",textAlign:"left",background:T.surf2,padding:"14px",borderRadius:"12px",border:bd}}>{devBio}</p>
            </div>
          </div>
        </div>
      </div>
    )}
    {showPro&&(
      <div className="ob" onClick={()=>setShowPro(false)}>
        <div className="mb" onClick={e=>e.stopPropagation()} style={{padding:"28px",textAlign:"center",maxWidth:"340px"}}>
          <div style={{width:"70px",height:"70px",borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"30px",fontWeight:"800",color:"#fff",margin:"0 auto 14px"}}>{(user[0]||"U").toUpperCase()}</div>
          <h3 style={{fontSize:"20px",fontWeight:"800",color:T.txt,marginBottom:"4px"}}>{user}</h3>
          <div style={{color:"#3b82f6",fontWeight:"700",fontSize:"12px",letterSpacing:"1px",marginBottom:"20px"}}>FREE · UNLIMITED</div>
          {[["💬","Chats",chats.length],["🌟","Plan","Free Forever"],["🤖","Engine","MK API"]].map(([ic,lb,vl],i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:T.surf2,borderRadius:"10px",border:bd,marginBottom:"8px"}}>
              <span style={{color:T.muted,fontSize:"13px"}}>{ic+" "+lb}</span>
              <span style={{color:T.txt,fontWeight:"700",fontSize:"13px"}}>{vl}</span>
            </div>
          ))}
          <button onClick={logout} style={{width:"100%",padding:"12px",background:"#ef4444",color:"#fff",border:"none",borderRadius:"10px",fontWeight:"700",fontSize:"14px",marginTop:"12px",cursor:"pointer"}}>Logout</button>
        </div>
      </div>
    )}
    {clearC&&(
      <div className="ob" onClick={()=>setClearC(false)}>
        <div className="mb" onClick={e=>e.stopPropagation()} style={{padding:"28px",textAlign:"center",maxWidth:"340px"}}>
          <div style={{fontSize:"44px",marginBottom:"12px"}}>⚠️</div>
          <h3 style={{fontSize:"18px",fontWeight:"800",color:T.txt,marginBottom:"8px"}}>Clear All History?</h3>
          <p style={{color:T.muted,fontSize:"14px",marginBottom:"22px",lineHeight:1.6}}>Permanently deletes all conversations.</p>
          <div style={{display:"flex",gap:"10px"}}>
            <button onClick={()=>setClearC(false)} style={{flex:1,padding:"12px",background:"transparent",border:bd,color:T.txt,borderRadius:"10px",fontWeight:"600",cursor:"pointer"}}>Cancel</button>
            <button onClick={()=>{setChats([]);newChat();setClearC(false);}} style={{flex:1,padding:"12px",background:"#ef4444",border:"none",color:"#fff",borderRadius:"10px",fontWeight:"700",cursor:"pointer"}}>Delete All</button>
          </div>
        </div>
      </div>
    )}
  </>);
}
