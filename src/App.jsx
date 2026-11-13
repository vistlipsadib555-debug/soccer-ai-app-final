import React, { useState, useRef } from 'react';
import './App.css';

// APIキーを環境変数から取得
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [advice, setAdvice] = useState("カメラを起動してフォームを撮影してください。結果解析がここに表示されます。");
  const [score, setScore] = useState(null);

  // 1. カメラを起動する処理
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error("カメラの起動に失敗しました:", err);
      alert("カメラへのアクセスが許可されていないか、利用できません。");
    }
  };

  // 2. ビデオの現在のフレームを画像（Base64）に変換する関数
  const captureFrameAsBase64 = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg');
    // 「data:image/jpeg;base64,」の部分を除いた純粋なBase64文字列を返す
    return dataUrl.split(',')[1];
  };

  // 3. Gemini API (REST API) に直接リクエストを送って解析する処理
  const handleAnalyzeForm = async () => {
    if (!isCameraActive) {
      alert("先にカメラを起動してください！");
      return;
    }

    setIsAnalyzing(true);
    setAdvice("AIコーチがフォームを解析中...");
    setScore(null);

    try {
      const base64Image = captureFrameAsBase64();
      if (!base64Image) {
        throw new Error("画像のキャプチャに失敗しました。");
      }

      // Gemini 2.5 Flash のエンドポイント
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

      const promptText = `あなたはプロのサッカーコーチです。送られたサッカーのフォームの画像を分析し、以下のJSON形式のみで回答してください。余分なテキストやマークダウンのバッククォート（\`\`\`jsonなど）は一切含めず、純粋なJSON文字列のオブジェクトだけを返してください。
      
      {
        "score": 0から100までの整数評価,
        "advice": "軸足の位置や上半身の傾きなどに触れながら、具体的で分かりやすい日本語の改善アドバイス（100文字程度）"
      }`;

      const requestBody = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image
                }
              },
              {
                text: promptText
              }
            ]
          }
        ]
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        throw new Error(`API通信エラー: ${res.status}`);
      }

      const data = await res.json();
      const rawText = data.candidates[0].content.parts[0].text.trim();
      
      // バッククォートなどが万が一含まれていた場合のクレンジング
      const cleanJsonText = rawText.replace(/^```json\s*|^```\s*|\s*```$/g, '');
      const result = JSON.parse(cleanJsonText);

      setScore(result.score);
      setAdvice(result.advice);

    } catch (err) {
      console.error("AI解析エラー:", err);
      setAdvice("解析に失敗しました。もう一度撮影して試してください。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">
          <span>⚽</span> サッカーAIコーチ
        </h1>
      </header>

      <div className="main-content">
        <div className="camera-container">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="camera-preview" 
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <div className="ai-result-card">
          <div className="ai-result-header">
            <span>🤖</span> AIコーチング・アドバイス
            {score !== null && (
              <span style={{ marginLeft: 'auto', color: '#10b981', fontWeight: 'bold' }}>
                評価: {score}点
              </span>
            )}
          </div>
          <p className="ai-result-text">
            {isAnalyzing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                <span className="spinner"></span> フォームを分析中...
              </span>
            ) : (
              advice
            )}
          </p>
        </div>
      </div>

      <div className="button-group">
        {!isCameraActive ? (
          <button className="btn btn-secondary" onClick={startCamera}>
            <span className="btn-content"><span>📷</span> カメラを起動</span>
          </button>
        ) : (
          <button 
            className="btn btn-primary" 
            onClick={handleAnalyzeForm}
            disabled={isAnalyzing}
          >
            <span className="btn-content">
              {isAnalyzing ? <span className="spinner"></span> : <span>🔴</span>}
              {isAnalyzing ? "解析中..." : "フォームを解析する"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export default App; // ←ここを修正 (※もしエラーが出たら export default App; にしてください)