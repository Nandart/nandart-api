// File: /api/submit.js

import formidable from 'formidable';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { Octokit } from 'octokit';

export const config = {
  api: {
    bodyParser: false,
  },
};

// 🌩️ Configuração Cloudinary
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nandart.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    console.log('[ERRO] Método não permitido');
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[ERRO] Ao processar o formulário:', err);
      return res.status(500).json({ message: 'Erro ao processar o formulário' });
    }

    const {
      titulo,
      descricao,
      enderecowallet,
      nomeartista,
      estilo,
      tecnica,
      ano,
      dimensoes,
      materiais,
      local
    } = fields;
    const imagem = files.imagem;

    console.log('[LOG] Campos recebidos:', fields);
    console.log('[LOG] Imagem recebida:', imagem);

    if (!titulo || !descricao || !enderecowallet || !imagem || !nomeartista || !estilo) {
      return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos' });
    }

    try {
      const filePath =
        imagem?.filepath ||
        imagem?.path ||
        (Array.isArray(imagem) && imagem[0]?.filepath) ||
        (Array.isArray(imagem) && imagem[0]?.path);

      if (!filePath) {
        return res.status(500).json({ message: 'Erro: Caminho do ficheiro não encontrado' });
      }

      const uploadResponse = await cloudinary.uploader.upload(filePath, {
        folder: 'nandart-submissoes',
      });

      const imageUrl = uploadResponse.secure_url;

      // 📝 Criar issue no GitHub
      const issueTitle = `🖼️ Nova Submissão: "${titulo}" por ${nomeartista}`;
      const issueBody = `
## Nova obra submetida à galeria NANdART

**🎨 Título:** ${titulo}  
**🧑‍🎨 Artista:** ${nomeartista}  
**📅 Ano:** ${ano || 'Não especificado'}  
**🖌️ Estilo:** ${estilo}  
**🧵 Técnica:** ${tecnica || 'Não especificada'}  
**📐 Dimensões:** ${dimensoes || 'Não especificadas'}  
**🧱 Materiais:** ${materiais || 'Não especificados'}  
**🌍 Local de criação:** ${local || 'Não especificado'}  

**📝 Descrição:**  
${descricao}

**👛 Carteira:** \`${enderecowallet}\`  
**📷 Imagem:**  
![Obra](${imageUrl})
      `;

      await octokit.rest.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: issueTitle,
        body: issueBody,
        labels: ['submissão', 'obra', 'pendente de revisão']
      });

      return res.status(200).json({
        message: 'Submissão recebida com sucesso!',
        imageUrl,
      });
    } catch (uploadError) {
      console.error('[ERRO] Ao fazer upload para Cloudinary ou criar issue:', uploadError);
      return res.status(500).json({ message: 'Erro ao fazer upload da imagem ou registar submissão' });
    }
  });
}
