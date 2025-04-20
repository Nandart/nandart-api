// File: /api/submit.js

import formidable from 'formidable';
import { v2 as cloudinary } from 'cloudinary';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
  },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ message: 'Erro ao processar o formulário' });
    }

    const { titulo, descricao, enderecowallet } = fields;
    const imagem = files.imagem;

    if (!titulo || !descricao || !enderecowallet || !imagem) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    }

    let urlImagem;
    try {
      const upload = await cloudinary.uploader.upload(imagem.filepath, {
        folder: 'nandart_obras',
        public_id: imagem.originalFilename.split('.')[0],
      });
      urlImagem = upload.secure_url;
    } catch (uploadErr) {
      return res.status(500).json({ message: 'Erro ao carregar imagem para o Cloudinary', detalhes: uploadErr.message });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO = 'nandart/nandart-submissoes';

    const issueBody = `
**🎨 Título da Obra:** ${titulo}
**🖋️ Descrição:**  
${descricao}

**🏦 Endereço da Wallet:** ${enderecowallet}
**🖼️ Imagem Submetida:** ![Obra](${urlImagem})
`;

    const response = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({
        title: `Nova Obra: ${titulo}`,
        body: issueBody,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(500).json({ message: 'Erro ao criar issue no GitHub', details: error });
    }

    res.status(200).json({ message: 'Submissão recebida com sucesso!' });
  });
}
