// File: /api/submissoes.js

import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
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
      labels: 'submissao,pendente de revisao',
      state: 'open',
      per_page: 100,
    });

    const pendentes = issues
      .filter(issue => issue.title && issue.body)
      .map(issue => {
        const linhas = issue.body.split('\n').map(l => l.trim());

        const getCampo = (campo) => {
          const linha = linhas.find(l => l.toLowerCase().startsWith(`${campo.toLowerCase()}:`));
          return linha ? linha.split(':').slice(1).join(':').trim() : null;
        };

        return {
          id: issue.number,
          titulo: getCampo('Titulo') || issue.title,
          nomeArtista: getCampo('Artista'),
          imagem: getCampo('Imagem'),
          url: issue.html_url
        };
      })
      .filter(o => o.titulo && o.nomeArtista && o.imagem);

    return res.status(200).json({ total: pendentes.length, pendentes });
  } catch (erro) {
    console.error('[ERRO] A obter submissões:', erro);
    return res.status(500).json({ message: 'Erro ao obter submissões' });
  }
}
