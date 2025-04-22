// File: /api/submit.js

import { IncomingForm } from 'formidable';
import { Octokit } from '@octokit/rest';
import cloudinary from 'cloudinary';
import fs from 'fs';
import { readFile } from 'fs/promises';

export const config = {
  api: {
    bodyParser: false
  }
};

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

function parseForm(req) {
  const form = new IncomingForm({ multiples: false });
  form.uploadDir = '/tmp';
  form.keepExtensions = true;

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function validarCampos(campos) {
  const obrigatorios = ['nome', 'titulo', 'descricao', 'estilo', 'tecnica', 'ano', 'dimensoes', 'materiais', 'local', 'carteira'];
  for (const campo of obrigatorios) {
    if (!campos[campo] || campos[campo].trim() === '') {
      return false;
    }
  }
  return true;
}

function criarCorpoIssue(dados, imagemUrl) {
  return `
**Título:** ${dados.titulo}
**Artista:** ${dados.nome}
**Ano:** ${dados.ano}
**Estilo:** ${dados.estilo}
**Técnica:** ${dados.tecnica}
**Dimensões:** ${dados.dimensoes}
**Materiais:** ${dados.materiais}
**Local:** ${dados.local}

**Descrição:**  
${dados.descricao}

**Carteira:**  
${dados.carteira}

**Imagem:**  
![Obra](${imagemUrl})
`;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://nandart.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { fields, files } = await parseForm(req);

    if (!validarCampos(fields) || !files.imagem) {
      return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos' });
    }

    const imagemPath = files.imagem.filepath || files.imagem.path;
    const imagemBuffer = await readFile(imagemPath);

    const upload = await cloudinary.v2.uploader.upload(imagemPath, {
      folder: 'nandart-obras'
    });

    const issue = await octokit.rest.issues.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `Nova Submissão: "${fields.titulo}" por ${fields.nome}`,
      body: criarCorpoIssue(fields, upload.secure_url),
      labels: ['obra']
    });

    return res.status(200).json({ message: 'Submissão recebida com sucesso', issueUrl: issue.data.html_url });
  } catch (erro) {
    console.error('[ERRO] Upload ou criação de issue:', erro);
    return res.status(500).json({ message: 'Erro ao processar a submissão' });
  }
}
