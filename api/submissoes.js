import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Se a requisição for para uma única submissão por ID
    const { id } = req.query;

    if (id) {
      const { data: issue } = await octokit.rest.issues.get({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        issue_number: id
      });

      const titulo = issue.title.replace(/^Nova Submissão: /i, '').replace(/"/g, '').trim();
      const nomeArtista = titulo.includes('por') ? titulo.split('por')[1].trim() : 'Artista Desconhecido';

      const body = issue.body || '';
      const imagemRegex = /!\[.*\]\((.*?)\)/;
      const imagemMatch = body.match(imagemRegex);
      const imagem = imagemMatch ? imagemMatch[1] : '';

      return res.status(200).json({
        id,
        titulo,
        nomeArtista,
        imagem
      });
    }

    // Se não for especificado um ID, listar todas as submissões pendentes
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'open',
      labels: 'obra'
    });

    const pendentes = issues.map((issue) => {
      const titulo = issue.title.replace(/^Nova Submissão: /i, '').replace(/"/g, '').trim();
      const nomeArtista = titulo.includes('por') ? titulo.split('por')[1].trim() : 'Artista Desconhecido';

      return {
        id: issue.number,
        titulo,
        nomeArtista,
        url: issue.html_url
      };
    });

    return res.status(200).json({
      total: pendentes.length,
      pendentes
    });

  } catch (erro) {
    console.error('[ERRO] Ao carregar submissões:', erro);
    return res.status(500).json({ message: 'Erro ao carregar submissões' });
  }
}
