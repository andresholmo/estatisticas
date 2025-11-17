export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const quizId = url.searchParams.get('id');

    if (!quizId) {
      const originUrl = new URL(request.url);
      originUrl.hostname = 'seriedrama.com';
      return fetch(originUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
    }

    let country = 'XX';
    if (request.cf && request.cf.country) {
      country = request.cf.country;
    } else if (request.headers.get('CF-IPCountry')) {
      country = request.headers.get('CF-IPCountry');
    }

    function escapeHtml(text) {
      if (!text) return '';
      const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
      return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    try {
      const jsonUrl = `https://quiz-lp.pages.dev/quiz-seriedrama/${quizId}.json`;
      const jsonResponse = await fetch(jsonUrl);

      if (!jsonResponse.ok) {
        const originUrl = new URL(request.url);
        originUrl.hostname = 'seriedrama.com';
        return fetch(originUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
      }

      const data = await jsonResponse.json();
      let quiz, gtmId, language;

      // Processamento simplificado - pega direto do data.quiz
      const rawQuiz = data.quiz;

      gtmId = data.gtmId || rawQuiz?.tracking?.gtmId || '';

      language = rawQuiz?.settings?.language || 'pt';

      // Monta estrutura unificada independente do formato original
      quiz = {
        type: rawQuiz?.type || 'standard',
        title: rawQuiz?.title || rawQuiz?.content?.header?.title || '',
        subtitle: rawQuiz?.subtitle || rawQuiz?.content?.subtitle || '',
        description: rawQuiz?.description || rawQuiz?.content?.description || '',
        filmImage: rawQuiz?.filmImage || rawQuiz?.content?.image || '',
        backgroundVideo: rawQuiz?.backgroundVideo || rawQuiz?.content?.backgroundVideo || '',
        assets: {
          logoUrl: rawQuiz?.assets?.logoUrl || '',
          iconUrl: rawQuiz?.assets?.iconUrl || '',
          privacyPolicyUrl: rawQuiz?.assets?.privacyPolicyUrl || '',
          privacyPolicyText: rawQuiz?.assets?.privacyPolicyText || ''
        },
        settings: {
          show_counter: rawQuiz?.settings?.show_counter !== false,
          prevent_back: rawQuiz?.settings?.prevent_back || false,
          language: language
        },
        redirectUrl: rawQuiz?.submit?.url || ''
      };

      // Check quiz types - apenas fake-cookies
      const isFakeCookies = quiz?.type === 'fake-cookies';

      const texts = {
        pt: {
          watching: 'pessoas estão assistindo agora',
          privacy: 'Política de Privacidade',
          cookiesTitle: 'Este site utiliza cookies',
          cookiesText: 'Utilizamos cookies para melhorar sua experiência. Ao continuar, você concorda com nossa política de cookies.',
          cookiesButton: 'OK'
        },
        en: {
          watching: 'people are watching right now',
          privacy: 'Privacy Policy',
          cookiesTitle: 'This site uses cookies',
          cookiesText: 'We use cookies to improve your experience. By continuing, you agree to our cookie policy.',
          cookiesButton: 'OK'
        },
        es: {
          watching: 'personas están viendo ahora mismo',
          privacy: 'Política de Privacidad',
          cookiesTitle: 'Este sitio utiliza cookies',
          cookiesText: 'Utilizamos cookies para mejorar su experiencia. Al continuar, acepta nuestra política de cookies.',
          cookiesButton: 'OK'
        },
        tr: {
          watching: 'kişi şu anda izliyor',
          privacy: 'Gizlilik Politikası',
          cookiesTitle: 'Bu site çerezleri kullanır',
          cookiesText: 'Deneyiminizi geliştirmek için çerezleri kullanıyoruz. Devam ederek çerez politikamızı kabul etmiş olursunuz.',
          cookiesButton: 'Tamam'
        },
        fr: {
          watching: 'personnes regardent en ce moment',
          privacy: 'Politique de Confidentialité',
          cookiesTitle: 'Ce site utilise des cookies',
          cookiesText: 'Nous utilisons des cookies pour améliorer votre expérience. En continuant, vous acceptez notre politique de cookies.',
          cookiesButton: 'OK'
        },
        de: {
          watching: 'Personen schauen gerade zu',
          privacy: 'Datenschutzerklärung',
          cookiesTitle: 'Diese Website verwendet Cookies',
          cookiesText: 'Wir verwenden Cookies, um Ihre Erfahrung zu verbessern. Durch Fortfahren stimmen Sie unserer Cookie-Richtlinie zu.',
          cookiesButton: 'OK'
        }
      };

      const currentTexts = texts[language] || texts.pt;

      const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
        .filter(param => url.searchParams.has(param))
        .map(param => `${param}=${encodeURIComponent(url.searchParams.get(param))}`)
        .join('&');

      const utmString = utmParams ? `?${utmParams}` : '';

      // RENDER: Fake Cookies Quiz
      if (isFakeCookies && quiz.backgroundVideo && quiz.redirectUrl) {
        const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no">
<title>${escapeHtml(quiz.title)}</title>
<link rel="icon" type="image/png" href="https://seriedrama.com/wp-content/uploads/2025/06/ico180.png">
<style>*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,'Noto Sans','Helvetica Neue',Helvetica,Arial,sans-serif}html,body{background:#000;height:100%;overflow:hidden}body{font-size:16px}.bg-container{position:fixed;top:0;left:0;width:100%;height:100vh;z-index:1}.bg-img{width:100%;height:100%;object-fit:cover;object-position:center}.bg-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.3);z-index:2}.play-section{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:3}.play-button{width:100px;height:100px;background:rgba(255,255,255,.95);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s ease;box-shadow:0 8px 24px rgba(0,0,0,.4);border:none}.play-button:hover{background:#fff;transform:scale(1.05)}.play-button:active{transform:scale(.95)}.play-icon{width:0;height:0;border-left:35px solid #e50914;border-top:22px solid transparent;border-bottom:22px solid transparent;margin-left:6px}.cookies-section{position:fixed;bottom:8%;left:50%;transform:translateX(-50%);z-index:4;width:90%;max-width:300px}.cookies-card{background:rgba(255,255,255,.95);backdrop-filter:blur(10px);border-radius:12px;padding:20px;box-shadow:0 4px 20px rgba(0,0,0,.25);text-align:left;border:1px solid rgba(255,255,255,.2)}.cookies-title{font-size:16px;font-weight:600;color:#333;margin-bottom:8px}.cookies-text{font-size:13px;color:#555;line-height:1.4;margin-bottom:16px}.ok-button{width:100%;padding:10px;background:#2196F3;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s ease}.ok-button:hover{background:#1976D2}.ok-button:active{transform:translateY(1px)}@media(max-width:768px){.play-button{width:80px;height:80px}.play-icon{border-left:28px solid #e50914;border-top:18px solid transparent;border-bottom:18px solid transparent;margin-left:5px}.cookies-section{width:95%;max-width:280px}.cookies-card{padding:18px}.cookies-title{font-size:15px}.cookies-text{font-size:12px;margin-bottom:14px}.ok-button{padding:9px;font-size:13px}}</style>
</head>
<body>
${gtmId ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer','${gtmId}')</script>` : ''}
${gtmId ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : ''}
<div class="bg-container">
<img class="bg-img" src="${quiz.backgroundVideo}" alt="bg" fetchpriority="high">
</div>
<div class="bg-overlay"></div>
<div class="play-section">
<button class="play-button" id="playBtn" type="button">
<div class="play-icon"></div>
</button>
</div>
<div class="cookies-section">
<div class="cookies-card">
<div class="cookies-title">${escapeHtml(currentTexts.cookiesTitle)}</div>
<div class="cookies-text">${escapeHtml(currentTexts.cookiesText)}</div>
<button class="ok-button" id="okBtn" type="button">${escapeHtml(currentTexts.cookiesButton)}</button>
</div>
</div>
<script>
var u="${utmString}",url="${quiz.redirectUrl}";
function r(){
  if(!u){location.href=url;return}
  var destUrl=new URL(url,location.origin);
  var params=new URLSearchParams(u.replace('?',''));
  params.forEach(function(v,k){if(!destUrl.searchParams.has(k))destUrl.searchParams.set(k,v)});
  location.href=destUrl.toString()
}
setTimeout(function(){
  var okBtn = document.getElementById("okBtn");
  var playBtn = document.getElementById("playBtn");
  
  if(okBtn) okBtn.addEventListener("click", r);
  if(playBtn) playBtn.addEventListener("click", r);
}, 100);
${quiz.settings.prevent_back ? `history.replaceState({},"",location.href);history.pushState({},"",location.href);addEventListener("popstate",function(){setTimeout(function(){history.pushState({},"",location.href)},0)});` : ''}
</script>
<script>
window.CF_COUNTRY="${country}";
setTimeout(function(){
var s=sessionStorage;if(s)s.setItem("ddmp_geo",(window.CF_COUNTRY||"all").toUpperCase());
var urls=["https://securepubads.g.doubleclick.net","https://www.googletagservices.com","https://ddmpads-cdn.pages.dev"];
urls.forEach(function(h){var l=document.createElement("link");l.rel="preconnect";l.href=h;l.crossOrigin="anonymous";document.head.appendChild(l)})
},200);
var geoScript=document.createElement("script");
geoScript.src="https://ddmpads-geo-injector.mateus-3d7.workers.dev/";
geoScript.async=true;
document.body.appendChild(geoScript);
</script>
<script>
(function(){var q="${quizId}",a="https://estatisticas-six.vercel.app/api/track",c=false;function g(){try{var p=new URLSearchParams(window.location.search);return p.get("utm_campaign")||null}catch(e){return null}}function s(e){var u=g();fetch(a,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:e,quizId:q,utm_campaign:u})}).catch(function(){})}function setup(){setTimeout(function(){s("view")},1000);function complete(){if(!c){c=true;s("complete")}}var okBtn=document.getElementById("okBtn");var playBtn=document.getElementById("playBtn");if(okBtn)okBtn.addEventListener("click",complete);if(playBtn)playBtn.addEventListener("click",complete)}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",setup)}else{setup()}})();
</script>
</body>
</html>`;

        return new Response(html, {
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff'
          }
        });
      }

      // RENDER: Standard Quiz (fallback para todos os outros tipos)
      const randomNumber = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
      const formattedNumber = randomNumber.toLocaleString('pt-BR');

      // Para standard quiz, buscar dados das questions
      const answers = rawQuiz?.content?.questions?.[0]?.answers || [];
      const question = rawQuiz?.content?.questions?.[0]?.question || '';
      
      let yesRedirectUrl = quiz.redirectUrl;
      if (!yesRedirectUrl && answers.length > 0) {
        yesRedirectUrl = answers[0].redirectUrl || '';
      }

      const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(quiz?.title || 'Quiz')}</title>
<link rel="icon" type="image/png" href="https://seriedrama.com/wp-content/uploads/2025/06/ico180.png">
<style>*{margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif}body{background:#f5f7f5;color:#333;line-height:1.4}.quiz-container{max-width:450px;margin:0 auto;background:#fff;text-align:center}.quiz-logo{margin:0 auto 20px}.quiz-logo img{max-width:180px;max-height:150px;height:auto}.quiz-counter{display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:14px;color:#0C2957}.quiz-counter-live{display:inline-block;width:14px;height:14px;margin-right:8px;border-radius:50%;background:#ff2d2d;animation:p 2s infinite}@keyframes p{0%,100%{box-shadow:0 0 0 0 rgba(255,45,45,.7)}70%{box-shadow:0 0 0 10px rgba(255,45,45,0)}}.quiz-counter-value{font-weight:bold}.quiz-title{font-size:20px;font-weight:bold;margin-bottom:20px}.quiz-central-image{max-width:60%;margin:20px auto;position:relative}.quiz-central-image img{width:100%;height:auto;border-radius:8px;cursor:pointer}.quiz-question{font-size:18px;margin:20px 15px}.quiz-answers{margin:0 15px}.quiz-button{width:100%;padding:12px 20px;margin-bottom:10px;font-size:16px;font-weight:bold;border:none;border-radius:4px;cursor:pointer;transition:opacity .2s;text-transform:uppercase}.quiz-button:hover{opacity:.9}.quiz-footer{font-size:12px;color:#999;margin:30px 0 15px;padding-top:10px;border-top:1px solid #eee}.quiz-privacy a{color:#999;text-decoration:none}@media(max-width:480px){.quiz-title{font-size:18px}.quiz-question{font-size:16px}}</style>
</head>
<body>
${gtmId ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer','${gtmId}')</script>` : ''}
${gtmId ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : ''}
<div class="quiz-container">
${quiz.assets.logoUrl ? `<div class="quiz-logo"><img src="${quiz.assets.logoUrl}" alt="Logo" width="180" height="60"></div>` : ''}
${quiz.settings.show_counter ? `<div class="quiz-counter"><span class="quiz-counter-live"></span><span class="quiz-counter-value" id="c">${formattedNumber} ${currentTexts.watching}</span></div>` : ''}
<h1 class="quiz-title">${escapeHtml(quiz?.title || '')}</h1>
${quiz.filmImage && yesRedirectUrl ? `<div class="quiz-central-image"><a href="${yesRedirectUrl}" id="imglink"><img src="${quiz.filmImage}" alt="${escapeHtml(quiz?.title || '')}" width="260" height="390" fetchpriority="high"></a></div>` : ''}
${question ? `<div class="quiz-question">${escapeHtml(question)}</div>` : ''}
<div class="quiz-answers">
${answers.map((answer, idx) => `<button class="quiz-button" style="background-color:${idx === 0 ? '#4caf50' : '#f44336'};color:#fff" data-url="${answer.redirectUrl || yesRedirectUrl}">${escapeHtml(answer.text)}</button>`).join('')}
</div>
<div class="quiz-footer"><div class="quiz-privacy"><a href="${quiz.assets.privacyPolicyUrl}" target="_blank" rel="noopener">${escapeHtml(quiz.assets.privacyPolicyText || currentTexts.privacy)}</a></div></div>
</div>
<script>
var u="${utmString}";
function r(b){
  if(!u){location.href=b;return}
  var url=new URL(b,location.origin);
  var params=new URLSearchParams(u.replace('?',''));
  params.forEach(function(v,k){if(!url.searchParams.has(k))url.searchParams.set(k,v)});
  location.href=url.toString()
}
document.addEventListener("DOMContentLoaded",function(){
${quiz.settings.show_counter ? `var mn=10000,mx=20000,t="${currentTexts.watching}";function up(){var v=Math.floor(Math.random()*(mx-mn+1))+mn,e=document.getElementById("c");if(e)e.textContent=v.toLocaleString("pt-BR")+" "+t}setInterval(up,10000);` : ''}
var btns=document.querySelectorAll(".quiz-button");
btns.forEach(function(btn){btn.addEventListener("click",function(){r(this.getAttribute("data-url"))})});
var il=document.getElementById("imglink");
if(il)il.addEventListener("click",function(e){e.preventDefault();r(this.href)});
${quiz.settings.prevent_back ? `history.replaceState({},"",location.href);history.pushState({},"",location.href);addEventListener("popstate",function(){setTimeout(function(){history.pushState({},"",location.href)},0)});` : ''}
});
</script>
<script>
window.CF_COUNTRY="${country}";
setTimeout(function(){
var s=sessionStorage;if(s)s.setItem("ddmp_geo",(window.CF_COUNTRY||"all").toUpperCase());
var urls=["https://securepubads.g.doubleclick.net","https://www.googletagservices.com","https://ddmpads-cdn.pages.dev"];
urls.forEach(function(h){var l=document.createElement("link");l.rel="preconnect";l.href=h;l.crossOrigin="anonymous";document.head.appendChild(l)})
},200);
var geoScript=document.createElement("script");
geoScript.src="https://ddmpads-geo-injector.mateus-3d7.workers.dev/";
geoScript.async=true;
document.body.appendChild(geoScript);
</script>
<script>
(function(){var q="${quizId}",a="https://estatisticas-six.vercel.app/api/track",c=false;function g(){try{var p=new URLSearchParams(window.location.search);return p.get("utm_campaign")||null}catch(e){return null}}function s(e){var u=g();fetch(a,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:e,quizId:q,utm_campaign:u})}).catch(function(){})}function setup(){setTimeout(function(){s("view")},1000);function complete(){if(!c){c=true;s("complete")}}var btns=document.querySelectorAll(".quiz-button");btns.forEach(function(btn){btn.addEventListener("click",complete)});var il=document.getElementById("imglink");if(il){il.addEventListener("click",complete)}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",setup)}else{setup()}})();
</script>
</body>
</html>`;

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff'
        }
      });

    } catch (error) {
      const originUrl = new URL(request.url);
      originUrl.hostname = 'seriedrama.com';
      return fetch(originUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
    }
  }
};
