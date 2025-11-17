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

      function detectLanguage(template, question, privacyText) {
        if (template) {
          if (template.includes('people are watching') || template.includes('people watching')) return 'en';
          if (template.includes('personas están viendo') || template.includes('personas viendo')) return 'es';
          if (template.includes('pessoas estão assistindo') || template.includes('pessoas assistindo')) return 'pt';
          if (template.includes('kişi şu anda izliyor') || template.includes('kişi izliyor')) return 'tr';
          if (template.includes('personnes regardent') || template.includes('personnes en train')) return 'fr';
          if (template.includes('Personen schauen gerade') || template.includes('Personen schauen')) return 'de';
        }
        if (question) {
          if (/are you over|do you want|would you like/i.test(question)) return 'en';
          if (/¿eres mayor|¿quieres|¿te gustaría/i.test(question)) return 'es';
          if (/você tem mais|você quer|você gostaria/i.test(question)) return 'pt';
          if (/yaşında mısınız|ister misiniz/i.test(question)) return 'tr';
          if (/avez-vous plus|voulez-vous|aimeriez-vous/i.test(question)) return 'fr';
          if (/sind sie über|möchten sie|würden sie/i.test(question)) return 'de';
        }
        if (privacyText) {
          if (/privacy policy/i.test(privacyText)) return 'en';
          if (/política de privacidad/i.test(privacyText)) return 'es';
          if (/política de privacidade/i.test(privacyText)) return 'pt';
          if (/gizlilik politikası/i.test(privacyText)) return 'tr';
          if (/politique de confidentialité/i.test(privacyText)) return 'fr';
          if (/datenschutzerklärung/i.test(privacyText)) return 'de';
        }
        return 'pt';
      }

      if (data.quiz && data.quiz.content) {
        const wpQuiz = data.quiz;
        gtmId = data.gtmId || wpQuiz.tracking?.gtmId || '';

        const counterTemplate = wpQuiz.counter?.template || '';
        const firstQuestion = wpQuiz.content.questions?.[0]?.question || '';
        const privacyText = wpQuiz.assets?.privacyPolicyText || '';

        language = detectLanguage(counterTemplate, firstQuestion, privacyText);
        if (wpQuiz.settings?.language) {
          language = wpQuiz.settings.language;
        }

        quiz = {
          title: wpQuiz.content.header?.title || wpQuiz.title || '',
          filmImage: wpQuiz.content.image || '',
          questions: [{
            question: firstQuestion,
            answers: wpQuiz.content.questions?.[0]?.answers?.map(ans => ({
              text: ans.text,
              value: ans.value,
              redirectUrl: wpQuiz.submit?.url || ''
            })) || []
          }],
          assets: {
            logoUrl: wpQuiz.assets?.logoUrl || '',
            iconUrl: wpQuiz.assets?.iconUrl || '',
            privacyPolicyUrl: wpQuiz.assets?.privacyPolicyUrl || '',
            privacyPolicyText: wpQuiz.assets?.privacyPolicyText || ''
          },
          settings: {
            show_counter: wpQuiz.counter?.showText === 1,
            prevent_back: true,
            counter_min: wpQuiz.counter?.min || 10000,
            counter_max: wpQuiz.counter?.max || 20000,
            update_interval: wpQuiz.counter?.updateInterval || 10,
            language: language
          }
        };
      } else {
        quiz = data.quiz;
        gtmId = data.gtmId || '';
        language = quiz?.settings?.language || 'pt';
      }

      const texts = {
        pt: { watching: 'pessoas estão assistindo agora', privacy: 'Política de Privacidade' },
        en: { watching: 'people are watching right now', privacy: 'Privacy Policy' },
        es: { watching: 'personas están viendo ahora mismo', privacy: 'Política de Privacidad' },
        tr: { watching: 'kişi şu anda izliyor', privacy: 'Gizlilik Politikası' },
        fr: { watching: 'personnes regardent en ce moment', privacy: 'Politique de Confidentialité' },
        de: { watching: 'Personen schauen gerade zu', privacy: 'Datenschutzerklärung' }
      };

      const currentTexts = texts[language] || texts.pt;

      const localeMap = {
        pt: 'pt-BR',
        en: 'en-US',
        es: 'es-ES',
        tr: 'tr-TR',
        fr: 'fr-FR',
        de: 'de-DE'
      };

      const currentLocale = localeMap[language] || localeMap['pt'] || 'pt-BR';
      const randomNumber = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
      const formattedNumber = randomNumber.toLocaleString(currentLocale);

      const logoUrl = quiz?.assets?.logoUrl || '';
      const filmImage = quiz?.filmImage || '';
      const question = quiz?.questions?.[0]?.question || '';
      const answers = quiz?.questions?.[0]?.answers || [];
      const privacyUrl = quiz?.assets?.privacyPolicyUrl || 'https://seriedrama.com/politica-de-privacidade/';
      const privacyText = quiz?.assets?.privacyPolicyText || currentTexts.privacy;

      let yesRedirectUrl = '';
      for (const answer of answers) {
        const val = answer.value?.toLowerCase() || '';
        if (val === 'yes' || val === 'sim' || val === 'sí' || val === 'ja' || val === 'oui' || val === 'evet' || val === 'option_0') {
          yesRedirectUrl = answer.redirectUrl;
          break;
        }
      }

      const showCounter = quiz?.settings?.show_counter !== false;
      const preventBack = quiz?.settings?.prevent_back || false;
      const counterMin = quiz?.settings?.counter_min || 10000;
      const counterMax = quiz?.settings?.counter_max || 20000;
      const updateInterval = quiz?.settings?.update_interval || 10;

      const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
        .filter(param => url.searchParams.has(param))
        .map(param => `${param}=${encodeURIComponent(url.searchParams.get(param))}`)
        .join('&');

      const utmString = utmParams ? `?${utmParams}` : '';

      const supportsWebP = request.headers.get('Accept')?.includes('image/webp');
      const filmImageWebP = filmImage ? filmImage.replace(/\.(jpg|jpeg|png)(\?.*)?$/i, '.$1.webp$2') : '';
      const logoUrlWebP = logoUrl ? logoUrl.replace(/\.(jpg|jpeg|png)(\?.*)?$/i, '.$1.webp$2') : '';

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
${logoUrl ? `<div class="quiz-logo"><picture>${supportsWebP ? `<source type="image/webp" srcset="${logoUrlWebP}">` : ''}<img src="${logoUrl}" alt="Logo" width="180" height="60"></picture></div>` : ''}
${showCounter ? `<div class="quiz-counter"><span class="quiz-counter-live"></span><span class="quiz-counter-value" id="c">${formattedNumber} ${currentTexts.watching}</span></div>` : ''}
<h1 class="quiz-title">${escapeHtml(quiz?.title || '')}</h1>
${filmImage && yesRedirectUrl ? `<div class="quiz-central-image"><a href="${yesRedirectUrl}" id="imglink"><picture>${supportsWebP ? `<source type="image/webp" srcset="${filmImageWebP}">` : ''}<img src="${filmImage}" alt="${escapeHtml(quiz?.title || '')}" width="260" height="390" fetchpriority="high"></picture></a></div>` : ''}
${question ? `<div class="quiz-question">${escapeHtml(question)}</div>` : ''}
<div class="quiz-answers">
${answers.map((answer, idx) => `<button class="quiz-button" style="background-color:${idx === 0 ? '#4caf50' : '#f44336'};color:#fff" data-url="${answer.redirectUrl}">${escapeHtml(answer.text)}</button>`).join('')}
</div>
<div class="quiz-footer"><div class="quiz-privacy"><a href="${privacyUrl}" target="_blank" rel="noopener">${escapeHtml(privacyText)}</a></div></div>
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
${showCounter ? `var mn=${counterMin},mx=${counterMax},t="${currentTexts.watching}",loc="${currentLocale}";function up(){var v=Math.floor(Math.random()*(mx-mn+1))+mn,e=document.getElementById("c");if(e)e.textContent=v.toLocaleString(loc)+" "+t}setInterval(up,${updateInterval}*1e3);` : ''}
var btns=document.querySelectorAll(".quiz-button");
btns.forEach(function(btn){btn.addEventListener("click",function(){r(this.getAttribute("data-url"))})});
var il=document.getElementById("imglink");
if(il)il.addEventListener("click",function(e){e.preventDefault();r(this.href)});
${preventBack ? `history.replaceState({},"",location.href);history.pushState({},"",location.href);addEventListener("popstate",function(){setTimeout(function(){history.pushState({},"",location.href)},0)});` : ''}
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
