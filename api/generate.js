module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topics, period, tone, keywords } = req.body;
  if (!topics || !topics.length) return res.status(400).json({ error: 'トピックを選択してください' });

  const toneMap = {
    student: '経験3年未満の若手スタッフ・専門学校生・大学生向けに、専門用語にはかんたんな説明を添えて、丁寧でわかりやすい口調'
  };

  // Step1: Tavilyで検索
  const searchQueries = topics.map(t => `舞台スタッフ ${t} 最新情報 ${period}`);
  if (keywords && keywords.length) searchQueries.push(`舞台技術 ${keywords.join(' ')} ${period}`);

  let searchResults = [];
  try {
    for (const query of searchQueries) {
      const r = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: 'basic',
          max_results: 3,
          include_answer: false
        })
      });
      const d = await r.json();
      if (d.results) searchResults = searchResults.concat(d.results);
    }
  } catch(e) {
    return res.status(500).json({ error: 'Tavily検索エラー: ' + e.message });
  }

  // 重複除去・上位10件
  const seen = new Set();
  const uniqueResults = searchResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  }).slice(0, 10);

  // 参照情報をテキスト化
  const sourcesText = uniqueResults.map((r, i) =>
    `[${i+1}] ${r.title}\nURL: ${r.url}\n内容: ${(r.content || '').slice(0, 300)}`
  ).join('\n\n');

  const kwText = keywords && keywords.length ? `追加キーワード: ${keywords.join('、')}` : '';

  // Step2: Claudeで記事生成
  const prompt = `あなたは舞台スタッフ向けnoteマガジン「舞台スタッフの学校」の編集者です。

以下の参照情報をもとに、note記事を作成してください。

【トピック】${topics.join('、')}
【期間】${period}
【文体】${toneMap[tone] || toneMap.professional}
【対象読者】現役舞台スタッフ・照明・音響・舞台機構・進行・大道具のプロおよび専門学校生
${kwText}

【参照情報（Web検索結果）】
${sourcesText}

【記事作成ルール】
- 本文は1,200〜1,800字
- 各トピックを見出し付きで解説
- 現場目線のコメントを必ず含める
- 参照した情報には必ず[1][2]のような番号で引用元を示す
- 本文の最後に「参照元」セクションとして番号・タイトル・URLをリスト形式で記載する

必ずJSON形式のみで返してください。マークダウン記法・コードブロック不要です。

{"title":"タイトル","lead":"リード文","body":"本文（引用番号と参照元セクション含む）","summary":"まとめ","tags":["タグ1","タグ2"],"sources":[{"index":1,"title":"タイトル","url":"https://..."}]}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: 'Anthropic APIエラー', detail: JSON.stringify(data.error) });

    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) return res.status(500).json({ error: '生成に失敗しました' });

    const clean = textBlock.text.replace(/```json|```/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'JSON解析失敗', raw: clean.slice(0, 300) });

    return res.status(200).json(JSON.parse(match[0]));
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
