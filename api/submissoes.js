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
      state: 'open',
      labels: 'submissão',
      per_page: 100,
    });

    const pendentes = issues
      .filter(issue => {
        const temAprovada = issue.labels.some(label => label.name === 'aprovada');
        return !temAprovada;
      })
      .map(issue => {
        const corpo = issue.body || '';
        const titulo = extrairCampo(corpo, 'Título');
        return {
          id: issue.number,
          titulo,
          url: issue.html_url,
        };
      });

    res.status(200).json({
      total: pendentes.length,
      pendentes,
    });
  } catch (erro) {
    console.error('[ERRO] Ao obter submissões:', erro);
    res.status(500).json({ message: 'Erro ao obter submissões' });
  }
}

function extrairCampo(corpo, campo) {
  const regex = new RegExp(`\\*\\*${campo}:\\*\\*\\s*(.+)`, 'i');
  const match = corpo.match(regex);
  return match ? match[1].trim().replace(/[`*_~]/g, '') : 'Sem título';
}
