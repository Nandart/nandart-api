// File: /api/submissoes.js

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
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'open',
      labels: 'submissão',
      per_page: 100
    });

    const pendentes = [];

    for (const issue of issues) {
      const labels = issue.labels.map((l) => (typeof l === 'string' ? l : l.name));
      if (!labels.includes('aprovada')) {
        const body = issue.body || '';
        const tituloMatch = body.match(/\*\*Título:\*\* (.+)/);
        const artistaMatch = body.match(/\*\*Artista:\*\* (.+)/);
        const imagemMatch = body.match(/!\[Obra\]\((.+)\)/);

        const titulo = tituloMatch ? tituloMatch[1].trim() : 'Sem título';
        const nomeArtista = artistaMatch ? artistaMatch[1].trim() : 'Desconhecido';
        const imagem = imagemMatch ? imagemMatch[1].trim() : null;

        pendentes.push({
          id: issue.number,
          titulo,
          nomeArtista,
          imagem,
          url: issue.html_url
        });
      }
    }

    return res.status(200).json({
      total: pendentes.length,
      pendentes
    });
  } catch (erro) {
    console.error('[ERRO] Ao carregar submissões:', erro);
    return res.status(500).json({ message: 'Erro ao carregar submissões pendentes' });
  }
}
