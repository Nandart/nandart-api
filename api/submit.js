// File: /api/submit.js

import formidable from 'formidable';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { Octokit } from '@octokit/rest';

export const config = {
  api: {
    bodyParser: false,
  },
};

// ☁️ Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🐙 GitHub
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

// 🔤 Função para remover emojis e caracteres especiais
function normalizarTexto(texto) {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remover acentos
    .replace(/[^\w\s-]/g, '') // remover emojis e símbolos
    .replace(/\s+/g, '-') // substituir espaços por hífens
    .toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[ERRO] Formulário:', err);
      return res.status(500).json({ message: 'Erro ao processar o formulário' });
    }

    const {
      nomeArtista,
      titulo,
      descricao,
      estilo,
      tecnica,
      ano,
      dimensoes,
      materiais,
      local,
      enderecowallet
    } = fields;

    const imagem = files.imagem;

    if (!nomeArtista || !titulo || !descricao || !estilo || !tecnica || !ano || !dimensoes || !materiais || !local || !enderecowallet || !imagem) {
      return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos' });
    }

    try {
      const filePath =
        imagem?.filepath ||
        imagem?.path ||
        (Array.isArray(imagem) && imagem[0]?.filepath) ||
        (Array.isArray(imagem) && imagem[0]?.path);

      if (!filePath) {
        return res.status(500).json({ message: 'Erro: Caminho do ficheiro da imagem não encontrado' });
      }

      const uploadResponse = await cloudinary.uploader.upload(filePath, {
        folder: 'nandart-submissoes',
      });

      const imageUrl = uploadResponse.secure_url;

      // ✏️ Normalizar para uso como título de issue
      const tituloNormalizado = normalizarTexto(titulo);
      const artistaNormalizado = normalizarTexto(nomeArtista);

      const issueTitle = `submissao-${tituloNormalizado}-${artistaNormalizado}`;
      const issueBody = `
## Submissão de obra para a galeria NANdART

**Título:** ${titulo}  
**Artista:** ${nomeArtista}  
**Ano:** ${ano}  
**Estilo:** ${estilo}  
**Técnica:** ${tecnica}  
**Dimensões:** ${dimensoes}  
**Materiais:** ${materiais}  
**Local de criação:** ${local}  
**Descrição:**  
${descricao}

**Endereço da Wallet:** \`${enderecowallet}\`

**Imagem:**  
${imageUrl}
      `;

      await octokit.rest.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: issueTitle,
        body: issueBody,
        labels: ['submissao', 'pendente']
      });

      return res.status(200).json({ message: 'Submissão recebida com sucesso!', imageUrl });
    } catch (error) {
      console.error('[ERRO] Upload ou criação de issue:', error);
      return res.status(500).json({ message: 'Erro ao fazer upload da imagem ou registar submissão' });
    }
  });
}
