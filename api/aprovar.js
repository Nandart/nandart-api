// File: /api/aprovar.js

import { Octokit } from '@octokit/rest';
import slugify from 'slugify';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';
const PUBLIC_BRANCH = process.env.REPO_PUBLIC_BRANCH || 'main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nandart.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ message: 'ID da issue não fornecido' });
    }

    // 1. Obter detalhes da issue
    const { data: issue } = await octokit.rest.issues.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: id,
    });

    const body = issue.body || '';
    const match = body.match(/\*\*🎨 Título:\*\* (.+?)  \n\*\*🧑‍🎨 Artista:\*\* (.+?)  /);

    if (!match) {
      return res.status(400).json({ message: 'Não foi possível extrair dados da issue.' });
    }

    const titulo = match[1];
    const nomeArtista = match[2];
    const slug = slugify(`${nomeArtista}-${titulo}`, { lower: true, strict: true });

    // 2. Criar ficheiro de metadados
    const fileContent = `---\ntitle: "${titulo}"
artist: "${nomeArtista}"
sourceIssue: ${id}\n---\n\n${body}`;
    const contentEncoded = Buffer.from(fileContent).toString('base64');

    const filePath = `obras/${slug}.md`;

    // 3. Criar PR para galeria pública
    const branchName = `add-obra-${slug}`;

    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: (await octokit.rest.repos.getCommit({ owner: REPO_OWNER, repo: REPO_NAME, ref: PUBLIC_BRANCH })).data.sha,
    });

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      message: `Adicionar nova obra: ${titulo}`,
      content: contentEncoded,
      branch: branchName,
    });

    await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `🎨 Adicionar nova obra: ${titulo}`,
      head: branchName,
      base: PUBLIC_BRANCH,
      body: `Esta PR adiciona a obra "${titulo}" de ${nomeArtista} à galeria pública.`,
    });

    // 4. Fechar a issue e atualizar etiquetas
    await octokit.rest.issues.update({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: id,
      state: 'closed',
    });

    await octokit.rest.issues.removeLabel({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: id,
      name: 'pendente de revisão',
    });

    await octokit.rest.issues.addLabels({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: id,
      labels: ['aprovado'],
    });

    return res.status(200).json({ message: 'Obra aprovada e PR criado com sucesso!' });
  } catch (error) {
    console.error('[ERRO] Ao criar PR automático:', error);
    return res.status(500).json({ message: 'Erro ao aprovar a obra e criar Pull Request.' });
  }
}
