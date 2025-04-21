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
    const issues = await octokit.rest.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'open',
      labels: 'submissão'
    });

    const pendentes = [];

    for (const issue of issues.data) {
      const corpo = issue.body || '';
      const linhas = corpo.split('\n');
      const dados = {};

      for (const linha of linhas) {
        const [chave, ...resto] = linha.split(':');
        if (chave && resto.length > 0) {
          dados[chave.trim().toLowerCase()] = resto.join(':').trim();
        }
      }

      if (dados['título'] && dados['nome do artista']) {
        pendentes.push({
          id: issue.number,
          titulo: `🖼️ ${dados['título']} por ${dados['nome do artista']}`,
          url: issue.html_url,
          imageUrl: dados['imagem'] || ''
        });
      }
    }

    return res.status(200).json({ total: pendentes.length, pendentes });
  } catch (erro) {
    console.error('Erro ao obter submissões:', erro);
    return res.status(500).json({ message: 'Erro ao obter submissões' });
  }
}
