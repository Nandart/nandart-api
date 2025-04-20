// File: /api/aprovar.js

import { Octokit } from "@octokit/core";

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
    // 🔍 Obter detalhes da issue
    const { data: issue } = await octokit.rest.issues.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: issueNumber
    });

    const tituloRaw = issue.title.replace(/^🖼️ Nova Submissão: "/, '').replace(/" por .+$/, '');
    const filename = `${tituloRaw.toLowerCase().replace(/\s+/g, '-')}.json`;

    const content = {
      titulo: tituloRaw,
      artista: extrairCampo(issue.body, '**🧑‍🎨 Artista:**'),
      ano: extrairCampo(issue.body, '**📅 Ano:**'),
      estilo: extrairCampo(issue.body, '**🖌️ Estilo:**'),
      tecnica: extrairCampo(issue.body, '**🧵 Técnica:**'),
      dimensoes: extrairCampo(issue.body, '**📐 Dimensões:**'),
      materiais: extrairCampo(issue.body, '**🧱 Materiais:**'),
      local: extrairCampo(issue.body, '**🌍 Local de criação:**'),
      descricao: extrairDescricao(issue.body),
      carteira: extrairCarteira(issue.body),
      imagem: extrairImagem(issue.body)
    };

    const encodedContent = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');

    // 🌱 Criar Pull Request com o novo ficheiro JSON da obra
    const branchName = `add-${filename.replace('.json', '')}`;

    // Criar nova branch
    const { data: mainRef } = await octokit.rest.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${REPO_BRANCH}`
    });

    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: mainRef.object.sha
    });

    // Criar novo ficheiro
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      branch: branchName,
      path: `${CONTENT_PATH}/${filename}`,
      message: `Adicionar nova obra: ${tituloRaw}`,
      content: encodedContent
    });

    // Criar Pull Request
    await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      head: branchName,
      base: REPO_BRANCH,
      title: `🎉 Aprovação de obra: ${tituloRaw}`,
      body: `A obra **${tituloRaw}** foi aprovada para publicação na galeria.`
    });

    // Atualizar labels da issue
    await octokit.rest.issues.update({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: issueNumber,
      labels: ['obra', 'aprovada']
    });

    return res.status(200).json({ message: 'Obra aprovada com sucesso e Pull Request criado!' });

  } catch (erro) {
    console.error('[ERRO] Ao aprovar a obra:', erro);
    return res.status(500).json({ message: 'Erro ao aprovar a obra' });
  }
}

// 🔎 Funções auxiliares para extrair campos do corpo da issue
function extrairCampo(corpo, campo) {
  const match = corpo.match(new RegExp(`${campo}\\s*(.*?)\\s*<br>`));
  return match ? match[1].trim() : 'Não especificado';
}

function extrairDescricao(corpo) {
  const match = corpo.match(/\*\*📝 Descrição:\*\*\s*<br>([\s\S]+?)<br>\*\*/);
  return match ? match[1].trim() : '';
}

function extrairCarteira(corpo) {
  const match = corpo.match(/\*\*👛 Carteira:\*\* `([^`]+)`/);
  return match ? match[1].trim() : '';
}

function extrairImagem(corpo) {
  const match = corpo.match(/!\[Obra]\((.*?)\)/);
  return match ? match[1] : '';
}
