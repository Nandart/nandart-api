// File: /api/submissoes.js

import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

export const config = {
  api: {
    bodyParser: false
  }
};

function extrairCampo(texto, chave) {
  const regex = new RegExp(`${chave}:\\s*(.*)`);
  const match = texto.match(regex);
  return match ? match[1].trim() : '';
}

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
      labels: 'obra',
      per_page: 100
    });

    const pendentes = issues
      .filter(issue => !issue.labels.some(label => label.name === 'aprovada'))
      .map(issue => {
        const body = issue.body || '';
        const titulo = extrairCampo(body, 'Título');
        const nomeArtista = extrairCampo(body, 'Artista');
        const imagemURL = extrairCampo(body, 'Imagem');

        return {
          id: issue.number,
          titulo,
          nomeArtista,
          imagem: imagemURL,
          url: issue.html_url
        };
      })
      .filter(obra => obra.titulo && obra.nomeArtista && obra.imagem);

    res.status(200).json({
      total: pendentes.length,
      pendentes
    });
  } catch (erro) {
    console.error('[ERRO] Ao carregar submissões:', erro);
    res.status(500).json({ message: 'Erro ao carregar submissões' });
  }
}
