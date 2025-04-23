// Importar bibliotecas necessárias
import { Octokit } from '@octokit/rest';
import formidable from 'formidable';
import cloudinary from 'cloudinary';

export const config = {
  api: {
    bodyParser: false  // Desativa o body parser padrão do Next.js para lidar com multipart/form-data
  }
};

export default async function handler(req, res) {
  // Definir cabeçalhos CORS para permitir acesso de qualquer origem
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Tratar requisição de pré-verificação (OPTIONS) do CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Apenas permitir requisições POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Use POST.' });
    return;
  }

  try {
    // Processar os dados do formulário multipart/form-data com formidable
    const form = formidable({ multiples: false }); // usar `multiples: true` se for esperado múltiplos arquivos
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // Validar se todos os campos obrigatórios estão presentes
    const requiredFields = ['nomeArtista', 'titulo', 'descricao', 'estilo', 'tecnica', 'ano', 'dimensoes', 'materiais', 'local', 'enderecowallet'];
    const missingFields = [];
    for (const field of requiredFields) {
      if (!fields[field] || fields[field].trim() === '') {
        missingFields.push(field);
      }
    }
    // Verificar se o arquivo de imagem foi enviado
    if (!files.imagem) {
      missingFields.push('imagem');
    }

    if (missingFields.length > 0) {
      // Mapear campos para nomes legíveis na mensagem de erro
      const fieldNames = {
        nomeArtista: 'Nome do Artista',
        titulo: 'Título',
        descricao: 'Descrição',
        estilo: 'Estilo',
        tecnica: 'Técnica',
        ano: 'Ano',
        dimensoes: 'Dimensões',
        materiais: 'Materiais',
        local: 'Local',
        enderecowallet: 'Endereço da Wallet',
        imagem: 'Imagem'
      };
      const missingList = missingFields.map(f => fieldNames[f] || f);
      res.status(400).json({ error: 'Campos obrigatórios em falta: ' + missingList.join(', ') });
      return;
    }

    // Configurar o Cloudinary com credenciais via variáveis de ambiente
    cloudinary.v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    // Enviar a imagem para o Cloudinary
    const imageFile = files.imagem;
    const filePath = imageFile.filepath || imageFile.path;  // caminho temporário do arquivo recebido
    const uploadResult = await cloudinary.v2.uploader.upload(filePath);
    const imageUrl = uploadResult.secure_url;

    // Inicializar o cliente Octokit (GitHub) com o token de autenticação
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Preparar título e corpo da issue em formato markdown
    const issueTitle = `${fields.titulo} - ${fields.nomeArtista}`;
    const issueBodyLines = [
      `Nome do Artista: ${fields.nomeArtista}`,
      `Título: ${fields.titulo}`,
      `Descrição: ${fields.descricao}`,
      `Estilo: ${fields.estilo}`,
      `Técnica: ${fields.tecnica}`,
      `Ano: ${fields.ano}`,
      `Dimensões: ${fields.dimensoes}`,
      `Materiais: ${fields.materiais}`,
      `Local: ${fields.local}`,
      `Endereço da Wallet: ${fields.enderecowallet}`,
      `Imagem: ${imageUrl}`
    ];
    const issueBody = issueBodyLines.join('\n');

    // Criar uma nova issue no repositório GitHub com os dados submetidos
    await octokit.rest.issues.create({
      owner: process.env.GITHUB_REPO_OWNER,  // usuário ou organização dona do repositório (definido em variáveis de ambiente)
      repo: 'nandart-submissoes',
      title: issueTitle,
      body: issueBody
    });

    // Responder com sucesso caso tudo tenha sido processado corretamente
    res.status(200).json({ message: 'Submissão recebida com sucesso.' });
  } catch (error) {
    console.error('Error processing submission:', error);
    res.status(500).json({ error: 'Erro ao processar a submissão.' });
  }
}
