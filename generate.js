export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topics, period, tone, keywords } = req.body;

  if (!topics || !topics.length) {
    return res.status(400).json({ error: 'トピックを選択してください' });
  }

  const kwText = keywords && keywords.length ? `追加キーワード: ${keywords.join('、')}` : '';

  const toneMap = {
    professional: 'プロ向け・専門的・現場経験者として語る口調',
    friendly: '親しみやすくフランクな口調',
    student: '初心者・専門学校生向けに丁寧でわかりやすい口調'
  };

  const prompt = `以下の条件でnote記事を作成してください。ウェブ検索で最新情報を収集してから記事を生成してください。

【トピック】${topics.join('、')}
【期間】${period}
【文体】${toneMap[tone] || toneMap.professional}
【対象読者】現役舞台スタッフ・照明・音響・舞台機構・進行・大道具のプロおよび専門学校生
${kwText}

【記事の構成】
- タイトル（クリックしたくなる具体的なタイトル）
- リード文（3〜4文）
- 本文（各トピックを見出し付きで1,200〜1,800字、現場目線のコメント必須）
- まとめ・締め
- ハッシュタグ（note用・5〜8個）

必ずJSON形式のみで返してください。前置きや説明は不要です。

{
  "title": "...",
  "lead": "...",
  "body": "...",
  "summary": "...",
  "tags": ["舞台スタッフ", "照明", ...]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'API error', detail: data });
    }

    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) {
      return res.status(500).json({ error: '生成に失敗しました' });
    }

    const clean = textBlock.text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'JSON解析に失敗しました' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
