// File: /api/submit.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  // Recolher dados do corpo da requisição
  const { titulo, descricao, enderecoWallet } = req.body;

  if (!titulo || !descricao || !enderecoWallet) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
  }

  // GitHub API para criar um issue
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO = 'teu-utilizador/nandart-submissoes'; // substitui com o teu utilizador e nome do repo

  const issueBody = `**Título da Obra:** ${titulo}

**Descrição:**
${descricao}

**Wallet:** ${enderecoWallet}`;

  const githubResponse = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json'
    },
    body: JSON.stringify({
      title: `Submissão de obra: ${titulo}`,
      body: issueBody
    })
  });

  if (!githubResponse.ok) {
    return res.status(500).json({ message: 'Erro ao criar submissão no GitHub' });
  }

  const data = await githubResponse.json();
  return res.status(200).json({ message: 'Submissão recebida com sucesso!', issueUrl: data.html_url });
}
