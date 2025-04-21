// File: /api/submit.js

import formidable from 'formidable';
import { v2 as cloudinary } from 'cloudinary';
import { Octokit } from '@octokit/rest';

export const config = {
  api: {
    bodyParser: false
  }
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

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
      const filePath = imagem?.filepath || imagem?.path;

      if (!filePath) {
        return res.status(500).json({ message: 'Erro: Caminho do ficheiro não encontrado' });
      }

      const uploadResponse = await cloudinary.uploader.upload(filePath, {
        folder: 'nandart-submissoes'
      });

      const imageUrl = uploadResponse.secure_url;

      const issueTitle = `🖼️ Nova Submissão: "${titulo}" por ${nomeArtista}`;
      const issueBody = `
## Nova obra submetida à galeria NANdART

**🎨 Título:** ${titulo}  
**🧑‍🎨 Artista:** ${nomeArtista}  
**📅 Ano:** ${ano}  
**🖌️ Estilo:** ${estilo}  
**🧵 Técnica:** ${tecnica}  
**📐 Dimensões:** ${dimensoes}  
**🧱 Materiais:** ${materiais}  
**🌍 Local:** ${local}  

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

      return res.status(200).json({ message: 'Submissão recebida com sucesso!', imageUrl });
    } catch (error) {
      console.error('[ERRO] Upload ou criação de issue:', error);
      return res.status(500).json({ message: 'Erro ao fazer upload da imagem ou registar submissão' });
    }
  });
}
