// File: /api/submit.js

import { IncomingForm } from 'formidable';
import { Octokit } from '@octokit/rest';
import cloudinary from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: false,
  },
};

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

function sanitize(texto) {
  return String(texto || '')
    .replace(/[^\w\s\-.,!?()áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]/g, '')
    .trim();
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ uploadDir: '/tmp', keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  try {
    const { fields, files } = await parseForm(req);

    const camposObrigatorios = [
      'nomeArtista', 'titulo', 'descricao', 'estilo', 'tecnica',
      'ano', 'dimensoes', 'materiais', 'local', 'carteira'
    ];

    for (const campo of camposObrigatorios) {
      if (!fields[campo] || fields[campo].toString().trim() === '') {
        return res.status(400).json({ message: `Campo obrigatório em falta: ${campo}` });
      }
    }

    if (!files.imagem) {
      return res.status(400).json({ message: 'Imagem não enviada' });
    }

    const filePath = files.imagem[0]?.filepath || files.imagem.filepath;
    const upload = await cloudinary.v2.uploader.upload(filePath, {
      folder: 'nandart-obras',
      public_id: uuidv4(),
    });

    const imageUrl = upload.secure_url;

    const corpoIssue = `
**Título**: ${sanitize(fields.titulo)}
**Artista**: ${sanitize(fields.nomeArtista)}
**Ano**: ${sanitize(fields.ano)}
**Estilo**: ${sanitize(fields.estilo)}
**Técnica**: ${sanitize(fields.tecnica)}
**Dimensões**: ${sanitize(fields.dimensoes)}
**Materiais**: ${sanitize(fields.materiais)}
**Local**: ${sanitize(fields.local)}
**Descrição**:  
${sanitize(fields.descricao)}

**Carteira**:  
${sanitize(fields.carteira)}

**Imagem**:  
![Obra](${imageUrl})
`;

    await octokit.rest.issues.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `Nova Submissão: "${sanitize(fields.titulo)}" por ${sanitize(fields.nomeArtista)}`,
      body: corpoIssue,
      labels: ['obra'],
    });

    return res.status(200).json({ message: 'Submissão recebida com sucesso!' });
  } catch (erro) {
    console.error('[ERRO] Upload ou criação de issue:', erro);
    return res.status(500).json({ message: 'Erro ao processar a submissão' });
  }
}
