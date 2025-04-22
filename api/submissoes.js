// File: /api/submissoes.js

import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

function extrairCampo(texto, campo) {
  const regex = new RegExp(`${campo}:\\s*(.+)`);
  const match = texto.match(regex);
  return match ? match[1].trim() : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      labels: 'obra',
      state: 'open'
    });

    const pendentes = issues.filter(issue => {
      return !issue.labels.some(label => label.name === 'aprovada');
    }).map(issue => {
      const body = issue.body;

      return {
        id: issue.number,
        titulo: extrairCampo(body, 'Título'),
        nomeArtista: extrairCampo(body, 'Artista'),
        imagem: extrairCampo(body, 'Imagem'),
        url: issue.html_url
      };
    }).filter(obra => obra.titulo && obra.nomeArtista && obra.imagem); // garante integridade mínima

    return res.status(200).json({ total: pendentes.length, pendentes });
  } catch (erro) {
    console.error('[ERRO] Ao carregar submissões:', erro);
    return res.status(500).json({ message: 'Erro ao carregar submissões' });
  }
}
