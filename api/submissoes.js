// File: /api/submissoes.js

import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://nandart.github.io');
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
      labels: 'obra',
      per_page: 100,
    });

    const pendentes = issues.data
      .filter(issue => {
        const labels = issue.labels.map(label => (typeof label === 'string' ? label : label.name));
        return !labels.includes('aprovada');
      })
      .map(issue => {
        const corpo = issue.body || '';
        const linhas = corpo.split('\n');

        const dados = {
          id: issue.number,
          url: issue.html_url,
          titulo: extrairValor(corpo, ['Título', 'Título da Obra']),
          nomeArtista: extrairValor(corpo, ['Artista', 'Nome do Artista']),
          imagem: extrairLinkImagem(corpo),
          descricao: extrairValor(corpo, ['Descrição', 'Descrição da Obra']),
          local: extrairValor(corpo, ['Local', 'Local de Criação']),
          ano: extrairValor(corpo, ['Ano', 'Ano de Criação']),
        };

        if (dados.titulo && dados.nomeArtista && dados.imagem && dados.descricao && dados.local && dados.ano) {
          return dados;
        }

        return null;
      })
      .filter(Boolean);

    res.status(200).json({ total: pendentes.length, pendentes });
  } catch (erro) {
    console.error('[ERRO] Ao obter submissões:', erro);
    res.status(500).json({ message: 'Erro ao obter submissões' });
  }
}

function extrairValor(texto, chaves) {
  for (const chave of chaves) {
    const regex = new RegExp(`\\*?\\*?${chave}:\\*?\\*?\\s*(.+)`, 'i');
    const match = texto.match(regex);
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

function extrairLinkImagem(texto) {
  const regex = /\[.*?\]\((https?:\/\/.*?)\)/;
  const match = texto.match(regex);
  return match ? match[1] : '';
}
