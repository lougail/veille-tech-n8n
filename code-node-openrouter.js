const articles = $input.all();

let articleList = "";
for (let i = 0; i < articles.length; i++) {
  const a = articles[i].json;
  articleList += `- ${a.title} (${a.link})\n`;
}

const prompt = `Tu es un assistant de veille technologique. Voici des articles recents :

${articleList}

Genere un rapport structure avec maximum 5 sujets. Pour chaque sujet :
- Un niveau de priorite : [CRITIQUE], [IMPORTANT] ou [VEILLE]
- Un titre court
- Un resume en 2-3 phrases
- Le lien source

Reponds en francais.`;

return [{
  json: {
    requestBody: {
      model: "google/gemini-2.0-flash-exp:free",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    }
  }
}];
