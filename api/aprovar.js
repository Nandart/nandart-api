// File: /api/aprovar.js

import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const REPO_OWNER = process.env.REPO_PUBLIC_OWNER;
const REPO_NAME = process.env.REPO_PUBLIC_NAME;
const REPO_BRANCH = process.env.REPO_PUBLIC_BRANCH;
const CONTENT_PATH = process.env.REPO_PUBLIC_CONTENT_PATH;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { issueNumber } = req.body;

  if (!issueNumber) {
    return res.status(400).json({ message: 'Número da issue não fornecido' });
  }

  try {
    const issue = await octokit.rest.issues.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: issueNumber
    });

    const titulo = issue.data.title.replace(/^🖼️ Submissão: /, '');
    const corpo = issue.data.body;

    const nomeDoFicheiro = `${titulo.toLowerCase().replace(/\s+/g, '-')}.json`;
    const conteudo = {
      titulo,
      descricao: corpo,
      origem: 'Submetido via painel de aprovação'
    };

    const contentBase64 = Buffer.from(JSON.stringify(conteudo, null, 2)).toString('base64');

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `${CONTENT_PATH}/${nomeDoFicheiro}`,
      message: `🎉 Aprovação de obra: ${titulo}`,
      content: contentBase64,
      branch: REPO_BRANCH
    });

    await octokit.rest.issues.update({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: issueNumber,
      state: 'closed'
    });

    return res.status(200).json({ message: 'Obra aprovada e publicada com sucesso!' });
  } catch (erro) {
    console.error('[ERRO] Ao aprovar a obra:', erro);
    return res.status(500).json({ message: 'Erro ao aprovar e publicar a obra.' });
  }
}
