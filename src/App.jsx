import { useState, useRef, useCallback } from "react";

const API_KEY = import.meta.env.VITE_ANTHROPIC_KEY;
const SYSTEM_PROMPT = `You are PERA AI, a friendly and smart voice assistant. Keep all answers short and conversational — perfect for speaking aloud. No bullet points or markdown. Talk naturally like a phone call. Be warm and helpful.`;

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const convRef = useRef([]);
  const synthRef = useRef(window.speechSynthesis);
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  const speak = useCallback((text) => {
    return new Promise((resolve) => {
      synthRef.current.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05;
      utter.pitch = 1;
      const voices = synthRef.current.getVoices();
      const preferred = voices.find(v =>
        v.name.includes("Google") || v.name.includes("Samantha")
      ) || voices[0];
      if (preferred) utter.voice = preferred;
      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => { setIsSpeaking(false); resolve(); };
      utter.onerror = () => { setIsSpeaking(false); resolve(); };
      synthRef.current.speak(utter);
    });
  }, []);

  const sendToAI = useCallback(async (userText) => {
    setIsThinking(true);
    convRef.current = [...convRef.current, { role: "user", content: userText }];
    setMessages(prev => [...prev, { role: "user", text: userText }]);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: convRef.current
        })
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, I could not get a response.";
      convRef.current = [...convRef.current, { role: "assistant", content: reply }];
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
      setIsThinking(false);
      await speak(reply);
    } catch {
      setIsThinking(false);
      setError("Connection error. Please try again.");
    }
  }, [speak]);

  const startListening = useCallback(() => {
    setError("");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Please use Chrome browser for voice."); return; }
    synthRef.current.cancel();
    setIsSpeaking(false);
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    recognitionRef.current = rec;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => { setIsListening(false); setTranscript(""); };
    rec.onerror = (e) => { setIsListening(false); if (e.error !== "no-speech") setError("Mic error: " + e.error); };
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join("");
      setTranscript(t);
      if (e.results[e.results.length - 1].isFinal) {
        rec.stop();
        if (t.trim()) sendToAI(t.trim());
      }
    };
    rec.start();
  }, [sendToAI]);

  const stopAll = () => {
    recognitionRef.current?.stop();
    synthRef.current.cancel();
    setIsSpeaking(false);
    setIsListening(false);
  };

  const status = isListening ? "listening" : isSpeaking ? "speaking" : isThinking ? "thinking" : "idle";

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0a0a0a 0%,#0d1f0d 50%,#0a0a0a 100%)",display:"flex",flexDirection:"column",alignItems:"center",padding:"0 16px 40px",fontFamily:"Georgia,serif",color:"#e8f0e8"}}>
      <div style={{width:"100%",maxWidth:560,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"24px 0 8px"}}>
        <div>
          <div style={{fontSize:26,fontWeight:"bold",letterSpacing:3,color:"#4caf50"}}>PERA AI</div>
          <div style={{fontSize:11,color:"#2d6e2d",letterSpacing:3,textTransform:"uppercase"}}>Your Voice Assistant</div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { convRef.current=[]; setMessages([]); stopAll(); }}
            style={{background:"transparent",border:"1px solid #1a3a1a",borderRadius:20,padding:"6px 14px",color:"#3a6e3a",cursor:"pointer",fontSize:12}}>
            Clear
          </button>
        )}
      </div>
      <div style={{margin:"30px 0 12px",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {[90,120,150].map((s,i) => (
          <div key={i} style={{position:"absolute",width:s,height:s,borderRadius:"50%",
            border:`1px solid rgba(76,175,80,${status!=="idle"?0.2-i*0.05:0.07})`,
            animation:status!=="idle"?`pulse ${1.2+i*0.4}s ease-in-out infinite`:"none",
            animationDelay:`${i*0.2}s`}} />
        ))}
        <button onClick={status==="idle"?startListening:stopAll} disabled={isThinking}
          style={{width:70,height:70,borderRadius:"50%",border:"none",cursor:isThinking?"not-allowed":"pointer",
            background:status==="listening"?"radial-gradient(circle,#2e7d32,#1b5e20)":
              status==="speaking"?"radial-gradient(circle,#4caf50,#2e7d32)":
              status==="thinking"?"radial-gradient(circle,#1a3a1a,#0d1f0d)":
              "radial-gradient(circle,#1a2e1a,#0a150a)",
            boxShadow:status!=="idle"?"0 0 30px rgba(76,175,80,0.5)":"0 0 10px rgba(76,175,80,0.2)",
            fontSize:26,transition:"all 0.3s"}}>
          {status==="listening"?"🎙️":status==="speaking"?"🔊":status==="thinking"?"⋯":"🎤"}
        </button>
      </div>
      <div style={{fontSize:12,letterSpacing:2,textTransform:"uppercase",marginBottom:6,color:status==="idle"?"#2d4a2d":"#4caf50",minHeight:18}}>
        {status==="listening"?"Listening…":status==="speaking"?"Speaking…":status==="thinking"?"Thinking…":"Tap to speak"}
      </div>
      {transcript && <div style={{fontSize:13,color:"#4caf50",fontStyle:"italic",marginBottom:6,maxWidth:500,textAlign:"center"}}>"{transcript}"</div>}
      {error && <div style={{fontSize:12,color:"#ef5350",background:"rgba(100,0,0,0.3)",padding:"6px 16px",borderRadius:20,marginBottom:8}}>{error}</div>}
      <div style={{width:"100%",maxWidth:560,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(76,175,80,0.1)",borderRadius:20,padding:16,marginTop:10,minHeight:200,maxHeight:"42vh",overflowY:"auto"}}>
        {messages.length===0 && !isThinking && (
          <div style={{textAlign:"center",color:"#1a3a1a",paddingTop:40}}>
            <div style={{fontSize:32,marginBottom:8}}>🌿</div>
            <div style={{fontSize:13,letterSpacing:1,color:"#2d4a2d"}}>Tap the mic and start talking</div>
            <div style={{fontSize:11,color:"#1a2e1a",marginTop:6}}>Ask me anything — I'll reply with voice</div>
          </div>
        )}
        {messages.map((m,i) => (
          <div key={i} style={{display:"flex",flexDirection:m.role==="user"?"row-reverse":"row",marginBottom:12,gap:8,alignItems:"flex-start"}}>
            <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,background:m.role==="user"?"rgba(76,175,80,0.15)":"rgba(46,125,50,0.2)",border:`1px solid ${m.role==="user"?"rgba(76,175,80,0.3)":"rgba(46,125,50,0.4)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>
              {m.role==="user"?"👤":"🤖"}
            </div>
            <div style={{background:m.role==="user"?"rgba(13,31,13,0.8)":"rgba(20,40,20,0.8)",border:`1px solid ${m.role==="user"?"rgba(76,175,80,0.15)":"rgba(46,125,50,0.2)"}`,borderRadius:m.role==="user"?"16px 4px 16px 16px":"4px 16px 16px 16px",padding:"8px 14px",maxWidth:"78%"}}>
              <div style={{fontSize:13,lineHeight:1.6,color:m.role==="user"?"#a5d6a7":"#e8f0e8"}}>{m.text}</div>
            </div>
          </div>
        ))}
        {isThinking && (
          <div style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:12}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(46,125,50,0.2)",border:"1px solid rgba(46,125,50,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🤖</div>
            <div style={{background:"rgba(20,40,20,0.8)",border:"1px solid rgba(46,125,50,0.2)",borderRadius:"4px 16px 16px 16px",padding:"12px 18px"}}>
              <div style={{display:"flex",gap:5}}>
                {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#4caf50",animation:"bounce 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s`}}/>)}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef}/>
      </div>
      <div style={{marginTop:16,fontSize:11,color:"#1a2e1a",letterSpacing:1,textAlign:"center"}}>USE CHROME FOR BEST EXPERIENCE</div>
      <style>{`
        @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.12);opacity:0.5}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
      `}</style>
    </div>
  );
}
