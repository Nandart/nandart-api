// File: /api/aprovar.js

import { Octokit } from '@octokit/rest';
import slugify from 'slugify';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';
const REPO_PUBLIC = 'nandart-galeria';
const BRANCH_DESTINO = 'main'; // Define o branch base de destino

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    console.error('[ERRO] Método não permitido');
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { id, titulo, nomeArtista, imagem } = req.body;

  if (!id || !titulo || !nomeArtista || !imagem) {
    console.warn('[AVISO] Dados em falta na submissão:', req.body);
    return res.status(400).json({ message: 'Dados em falta na submissão' });
  }

  try {
    const slug = slugify(`${nomeArtista}-${titulo}`, { lower: true, strict: true });
    const filePath = `galeria/obras/${slug}.md`;

    const conteudo = `---
titulo: "${titulo}"
artista: "${nomeArtista}"
imagem: "${imagem}"
slug: "${slug}"
---`.trim();

    const contentEncoded = Buffer.from(conteudo).toString('base64');

    // 1. Obter SHA do último commit do branch destino
    let shaBase;
    try {
      const { data: refData } = await octokit.rest.git.getRef({
        owner: REPO_OWNER,
        repo: REPO_PUBLIC,
        ref: `heads/${BRANCH_DESTINO}`
      });
      shaBase = refData.object.sha;
    } catch (err) {
      console.error('[ERRO] Não foi possível obter o SHA base do branch destino:', err);
      return res.status(500).json({ message: 'Erro ao obter o estado atual do repositório base.' });
    }

    // 2. Criar novo branch
    const branchName = `aprovacao-${id}-${Date.now()}`;
    try {
      await octokit.rest.git.createRef({
        owner: REPO_OWNER,
        repo: REPO_PUBLIC,
        ref: `refs/heads/${branchName}`,
        sha: shaBase
      });
    } catch (err) {
      console.error('[ERRO] Falha ao criar novo branch:', err);
      return res.status(500).json({ message: 'Erro ao criar o branch para aprovação' });
    }

    // 3. Adicionar o ficheiro da obra
    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_PUBLIC,
        path: filePath,
        message: `Adicionar nova obra: ${titulo}`,
        content: contentEncoded,
        branch: branchName
      });
    } catch (err) {
      console.error('[ERRO] Falha ao adicionar o ficheiro ao repositório:', err);
      return res.status(500).json({ message: 'Erro ao adicionar o ficheiro da obra' });
    }

    // 4. Criar Pull Request
    try {
      await octokit.rest.pulls.create({
        owner: REPO_OWNER,
        repo: REPO_PUBLIC,
        title: `Aprovar nova obra: ${titulo}`,
        head: branchName,
        base: BRANCH_DESTINO,
        body: `Esta obra foi aprovada no painel e está pronta para ser integrada na galeria.`
      });
    } catch (err) {
      console.error('[ERRO] Falha ao criar Pull Request:', err);
      return res.status(500).json({ message: 'Erro ao criar o Pull Request' });
    }

    // 5. Atualizar a issue como aprovada
    try {
      await octokit.rest.issues.update({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        issue_number: id,
        labels: ['aprovada', 'obra']
      });
    } catch (err) {
      console.warn('[AVISO] Falha ao atualizar labels da issue:', err);
    }

    return res.status(200).json({ message: 'Pull Request criado com sucesso!' });

  } catch (erro) {
    console.error('[ERRO] Exceção geral ao processar aprovação:', erro);
    return res.status(500).json({ message: 'Erro inesperado durante a aprovação' });
  }
}
