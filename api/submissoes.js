// File: /api/submissoes.js

import { Octokit } from '@octokit/rest';

export const config = {
  api: {
    bodyParser: false,
  },
};

// 🐙 GitHub
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
      labels: ['submissão', 'pendente de revisão'],
    });

    const pendentes = issues.map((issue) => {
      const titulo = extrairCampo(issue.body, '🎨 Título');
      const nomeArtista = extrairCampo(issue.body, '🧑‍🎨 Artista');

      return {
        id: issue.number,
        titulo: `🖼️ ${titulo} por ${nomeArtista}`,
        url: issue.html_url,
        criadoEm: issue.created_at,
      };
    });

    res.status(200).json({
      total: pendentes.length,
      pendentes,
    });
  } catch (error) {
    console.error('[ERRO] Ao obter submissões pendentes:', error);
    res.status(500).json({ message: 'Erro ao obter submissões pendentes' });
  }
}

// Função auxiliar para extrair campos com base no emoji + título
function extrairCampo(texto, marcador) {
  const regex = new RegExp(`\\*\\*${escapeRegex(marcador)}:\\*\\*\\s*(.+)`);
  const match = texto.match(regex);
  return match ? match[1].trim() : '[Campo não encontrado]';
}

// Função auxiliar para escapar caracteres especiais no regex
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
