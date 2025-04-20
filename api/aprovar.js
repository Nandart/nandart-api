// File: /api/aprovar.js

import { Octokit } from 'octokit';
import fetch from 'node-fetch';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';
const SITE_REPO = 'nandart-site';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const { issueNumber } = req.body;

  if (!issueNumber) {
    return res.status(400).json({ message: 'Número da issue em falta.' });
  }

  try {
    // Obter dados da issue
    const issue = await octokit.rest.issues.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: issueNumber,
    });

    const body = issue.data.body;
    const titulo = issue.data.title;
    const nomeFicheiro = titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.md';

    // Gerar conteúdo para a obra
    const content = `---\ntitle: \"${titulo}\"\ndate: \"${new Date().toISOString()}\"\n---\n\n${body}`;

    const encodedContent = Buffer.from(content).toString('base64');

    // Criar branch temporária
    const mainRef = await octokit.rest.git.getRef({
      owner: REPO_OWNER,
      repo: SITE_REPO,
      ref: 'heads/main',
    });

    const newBranch = `add-obra-${Date.now()}`;

    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: SITE_REPO,
      ref: `refs/heads/${newBranch}`,
      sha: mainRef.data.object.sha,
    });

    // Criar novo ficheiro na galeria
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: SITE_REPO,
      path: `obras/${nomeFicheiro}`,
      message: `Adicionar nova obra: ${titulo}`,
      content: encodedContent,
      branch: newBranch,
    });

    // Criar Pull Request
    const pr = await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: SITE_REPO,
      title: `🎨 Aprovar obra: ${titulo}`,
      head: newBranch,
      base: 'main',
      body: 'Esta PR adiciona uma nova obra à galeria com base na submissão aprovada.',
    });

    return res.status(200).json({ message: 'Pull Request criada com sucesso!', prUrl: pr.data.html_url });
  } catch (error) {
    console.error('[ERRO] Ao aprovar a obra:', error);
    return res.status(500).json({ message: 'Erro ao aprovar a obra.' });
  }
}
