// Proxies barcode lookups to Open Food Facts (free, no key required) so the
// browser never has to depend on their CORS policy directly, and so we can
// trim the response to just the fields the frontend needs.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const barcode = String(req.query.barcode || '').replace(/[^0-9]/g, '');
  if (!barcode) {
    return res.status(400).json({ error: 'Missing or invalid barcode' });
  }

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,ingredients_text,nutriments,serving_size,image_front_url`
    );

    if (!response.ok) {
      throw new Error(`Open Food Facts error ${response.status}`);
    }

    const data = await response.json();
    if (data.status !== 1 || !data.product) {
      return res.status(404).json({ error: 'No product found for that barcode in Open Food Facts' });
    }

    return res.status(200).json({ product: data.product });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
