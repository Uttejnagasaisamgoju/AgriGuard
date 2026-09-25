/**
 * Centralized Agricultural Disease Image Registry
 * Maps disease name and crop type to the authentic, dedicated reference photograph.
 */

export const DISEASE_IMAGE_REGISTRY: Record<string, string> = {
  // Rice
  'rice:brown spot': '/diseases/rice_brown_spot.jpg',
  'rice:blast': '/diseases/rice_blast.jpg',
  'rice:leaf blast': '/diseases/rice_blast.jpg',
  'rice:bacterial blight': '/diseases/rice_bacterial_blight.jpg',

  // Tomato
  'tomato:early blight': '/diseases/tomato_early_blight.jpg',
  'tomato:late blight': '/diseases/tomato_late_blight.jpg',
  'tomato:leaf blight': '/diseases/tomato_early_blight.jpg',
  'tomato:bacterial spot': '/diseases/tomato_bacterial_spot.jpg',
  'tomato:yellow leaf curl virus': '/diseases/tomato_yellow_leaf_curl.jpg',
  'tomato:whitefly': '/diseases/tomato_whitefly.jpg',
  'tomato:mosaic virus': '/diseases/tomato_mosaic_virus.jpg',

  // Potato
  'potato:early blight': '/diseases/potato_early_blight.jpg',
  'potato:late blight': '/diseases/potato_late_blight.jpg',

  // Maize / Corn
  'maize:common rust': '/diseases/maize_common_rust.jpg',
  'corn_(maize):common rust': '/diseases/maize_common_rust.jpg',
  'maize:gray leaf spot': '/diseases/maize_gray_leaf_spot.jpg',
  'corn_(maize):gray leaf spot': '/diseases/maize_gray_leaf_spot.jpg',

  // Wheat
  'wheat:rust': '/diseases/wheat_rust.jpg',
  'wheat:stripe rust': '/diseases/wheat_rust.jpg',
  'wheat:leaf rust': '/diseases/wheat_rust.jpg',

  // Cucumber
  'cucumber:downy mildew': '/diseases/cucumber_downy_mildew.jpg',

  // Multiple Crops / General
  'multiple crops:aphids': '/diseases/aphids_multiple_crops.jpg',
  'multiple crops:powdery mildew': '/diseases/powdery_mildew.jpg',
  'all:aphids': '/diseases/aphids_multiple_crops.jpg',
  'all:powdery mildew': '/diseases/powdery_mildew.jpg',
  'squash:powdery mildew': '/diseases/powdery_mildew.jpg',
};

/**
 * Returns the authentic reference photo URL for a disease and crop combination.
 * Checks disease.reference_images first, then matches the registry by name + crop.
 */
export function getDiseaseReferenceImage(
  diseaseName?: string,
  cropType?: string,
  existingReferenceImages?: string[]
): string | null {
  // 1. If existing reference_images provided from DB, use the first valid entry
  if (existingReferenceImages && existingReferenceImages.length > 0 && existingReferenceImages[0]) {
    return existingReferenceImages[0];
  }

  if (!diseaseName) return null;

  const d = diseaseName.trim().toLowerCase();
  const c = (cropType || '').trim().toLowerCase();

  // Try exact match with crop
  const compositeKey = `${c}:${d}`;
  if (DISEASE_IMAGE_REGISTRY[compositeKey]) {
    return DISEASE_IMAGE_REGISTRY[compositeKey];
  }

  // Try partial name matches
  if (d.includes('brown spot')) return '/diseases/rice_brown_spot.jpg';
  if (d.includes('blast')) return '/diseases/rice_blast.jpg';
  if (d.includes('bacterial blight')) return '/diseases/rice_bacterial_blight.jpg';
  if (d.includes('bacterial spot')) return '/diseases/tomato_bacterial_spot.jpg';
  if (d.includes('early blight')) {
    return c.includes('potato') ? '/diseases/potato_early_blight.jpg' : '/diseases/tomato_early_blight.jpg';
  }
  if (d.includes('late blight')) {
    return c.includes('potato') ? '/diseases/potato_late_blight.jpg' : '/diseases/tomato_late_blight.jpg';
  }
  if (d.includes('leaf blight')) return '/diseases/tomato_early_blight.jpg';
  if (d.includes('downy mildew')) return '/diseases/cucumber_downy_mildew.jpg';
  if (d.includes('powdery mildew')) return '/diseases/powdery_mildew.jpg';
  if (d.includes('aphid')) return '/diseases/aphids_multiple_crops.jpg';
  if (d.includes('whitefly')) return '/diseases/tomato_whitefly.jpg';
  if (d.includes('stripe rust') || d.includes('rust')) {
    return c.includes('corn') || c.includes('maize') ? '/diseases/maize_common_rust.jpg' : '/diseases/wheat_rust.jpg';
  }
  if (d.includes('gray leaf spot')) return '/diseases/maize_gray_leaf_spot.jpg';
  if (d.includes('yellow leaf curl')) return '/diseases/tomato_yellow_leaf_curl.jpg';
  if (d.includes('mosaic')) return '/diseases/tomato_mosaic_virus.jpg';

  return null;
}

export const BASE_REFERENCE_DISEASES: Array<{
  id: string;
  name: string;
  crop_type: string;
  category: string;
  image: string;
  symptoms: string[];
  causes: string;
  management: string[];
}> = [
  {
    id: 'tomato-mosaic-virus',
    name: 'Mosaic Virus',
    crop_type: 'Tomato',
    category: 'Viral',
    image: '/diseases/tomato_mosaic_virus.jpg',
    symptoms: [
      'Mottled pattern of light and dark green on leaves',
      'Leaf distortion, blistering, and crinkling of foliage',
      'Stunted plant growth and uneven fruit ripening',
    ],
    causes: 'Tomato mosaic virus (ToMV) transmitted mechanically, by handling, tools, or infected seed.',
    management: [
      'Disinfect pruning shears and farm tools with 10% bleach solution',
      'Wash hands thoroughly before handling tomato seedlings',
      'Plant certified ToMV-resistant hybrid varieties',
      'Immediately rogue out and destroy symptomatic infected vines',
    ],
  },
  {
    id: 'rice-brown-spot',
    name: 'Brown Spot',
    crop_type: 'Rice',
    category: 'Fungal',
    image: '/diseases/rice_brown_spot.jpg',
    symptoms: [
      'Small, circular brown spots with yellow halos across leaves',
      'Spots enlarge and coalesce into dark brown lesions with gray centers',
      'Severely reduces photosynthetic area and grain weight',
    ],
    causes: 'Bipolaris oryzae fungal pathogen favored by high humidity and nutrient-deficient soils.',
    management: [
      'Apply Mancozeb 75% WP or Tricyclazole 75% WP',
      'Correct soil potassium and balanced nitrogen levels',
      'Maintain adequate water level and avoid drought stress',
    ],
  },
  {
    id: 'rice-blast',
    name: 'Blast',
    crop_type: 'Rice',
    category: 'Fungal',
    image: '/diseases/rice_blast.jpg',
    symptoms: [
      'Diamond or spindle-shaped lesions with gray ash centers and brown margins',
      'Neck rot causing empty, bleached panicles (neck blast)',
      'Rapid foliar death under cool night temperatures and high dew',
    ],
    causes: 'Magnaporthe oryzae fungus spreading rapidly through airborne spores.',
    management: [
      'Foliar spray of Tricyclazole 75% WP @ 0.6g/L water',
      'Avoid excessive nitrogen top-dressing',
      'Plant blast-resistant certified hybrid cultivars',
    ],
  },
  {
    id: 'rice-bacterial-blight',
    name: 'Bacterial Blight',
    crop_type: 'Rice',
    category: 'Bacterial',
    image: '/diseases/rice_bacterial_blight.jpg',
    symptoms: [
      'Water-soaked lesions on leaf margins turning yellow then bleach-white',
      'Wavy lesion margins progressing downward along the leaf blade',
      'Milky bacterial ooze droplets on morning dew',
    ],
    causes: 'Xanthomonas oryzae pv. oryzae entering via natural hydathodes or wounds.',
    management: [
      'Apply Copper Oxychloride 50% WP @ 3g/L with Streptomycin',
      'Drain excess standing water to reduce humidity',
      'Avoid overhead flooding between contiguous fields',
    ],
  },
  {
    id: 'tomato-early-blight',
    name: 'Early Blight',
    crop_type: 'Tomato',
    category: 'Fungal',
    image: '/diseases/tomato_early_blight.jpg',
    symptoms: [
      'Dark brown concentric rings forming distinctive "target board" spots',
      'Chlorotic yellow halos surrounding necrotic lesions',
      'Premature defoliation starting from lower foliage upward',
    ],
    causes: 'Alternaria solani pathogen thriving in warm, fluctuating wet and dry conditions.',
    management: [
      'Apply Chlorothalonil 75% WP @ 2g/L or Mancozeb 75% WP',
      'Remove and destroy diseased lower canopy leaves',
      'Use drip irrigation instead of overhead watering',
    ],
  },
  {
    id: 'tomato-late-blight',
    name: 'Late Blight',
    crop_type: 'Tomato',
    category: 'Fungal',
    image: '/diseases/tomato_late_blight.jpg',
    symptoms: [
      'Large, irregular water-soaked dark olive-brown to greasy black lesions',
      'White velvety fungal mold halo along lesion borders on leaf underside',
      'Rapid collapse and foul odor of foliage and green fruit',
    ],
    causes: 'Phytophthora infestans oomycete spreading with explosive speed in cool, wet weather.',
    management: [
      'Spray Metalaxyl + Mancozeb (Ridomil Gold) @ 2.5g/L water',
      'Destroy and bury heavily blighted tomato vines immediately',
      'Ensure high plant spacing for canopy ventilation',
    ],
  },
  {
    id: 'cucumber-downy-mildew',
    name: 'Downy Mildew',
    crop_type: 'Cucumber',
    category: 'Fungal',
    image: '/diseases/cucumber_downy_mildew.jpg',
    symptoms: [
      'Angular chlorotic yellow patches strictly bounded by leaf veins',
      'Purplish-gray downy mold layer visible on the leaf underside',
      'Leaves brown and curl like parchment under severe infection',
    ],
    causes: 'Pseudoperonospora cubensis oomycete favored by morning dew and high humidity.',
    management: [
      'Apply Cymoxanil + Mancozeb WP @ 2g/L water at first sign',
      'Water only at ground level early in the morning',
      'Trellis cucumber vines to keep foliage off moist soil',
    ],
  },
  {
    id: 'aphids-multiple-crops',
    name: 'Aphids',
    crop_type: 'Multiple Crops',
    category: 'Pest',
    image: '/diseases/aphids_multiple_crops.jpg',
    symptoms: [
      'Dense colonies of green and black sap-sucking insects under leaves',
      'Severe leaf curling, crumpling, and stunted shoot tips',
      'Sticky honeydew secretions with black sooty mold growth',
    ],
    causes: 'Aphis gossypii / Myzus persicae insect pests transmitting plant viruses.',
    management: [
      'Spray Neem oil extract (5ml/L water) or insecticidal soap',
      'Apply Imidacloprid 17.8% SL @ 0.3ml/L for heavy infestations',
      'Preserve and introduce beneficial ladybird beetle predators',
    ],
  },
  {
    id: 'tomato-whitefly',
    name: 'Whitefly',
    crop_type: 'Tomato',
    category: 'Pest',
    image: '/diseases/tomato_whitefly.jpg',
    symptoms: [
      'Clouds of tiny white-winged insects fluttering when plants are disturbed',
      'Mottled leaf chlorosis and upward leaf curling',
      'Vector for debilitating Tomato Yellow Leaf Curl Virus (TYLCV)',
    ],
    causes: 'Bemisia tabaci insect vector feeding on plant sap.',
    management: [
      'Install yellow sticky cards at canopy height across field',
      'Spray Acetamiprid 20% SP @ 0.5g/L water or Spiromesifen',
      'Cover nursery seedlings with 50-mesh insect-proof netting',
    ],
  },
  {
    id: 'wheat-rust',
    name: 'Rust',
    crop_type: 'Wheat',
    category: 'Fungal',
    image: '/diseases/wheat_rust.jpg',
    symptoms: [
      'Bright orange-yellow to reddish powdery pustules erupting on leaf blades',
      'Parallel linear stripes along leaf veins in stripe rust',
      'Premature leaf senescence and severe shriveling of wheat grains',
    ],
    causes: 'Puccinia striiformis / Puccinia triticina fungi with wind-blown spores.',
    management: [
      'Foliar spray of Propiconazole 25% EC @ 1ml/L water upon first pustules',
      'Sow certified rust-resistant wheat varieties',
      'Timely early planting to avoid peak high-temperature rust flare-ups',
    ],
  },
  {
    id: 'potato-early-blight',
    name: 'Early Blight',
    crop_type: 'Potato',
    category: 'Fungal',
    image: '/diseases/potato_early_blight.jpg',
    symptoms: [
      'Concentric target-board brown spots on mature lower foliage',
      'Yellow chlorotic halos around necrotic lesions',
      'Tuber surface depression with corky dry rot under skin',
    ],
    causes: 'Alternaria solani fungus persisting on crop residue.',
    management: [
      'Apply Mancozeb 75% WP @ 2g/L or Azoxystrobin',
      'Practice 3-year crop rotation avoiding solanaceous crops',
      'Maintain balanced plant nutrition with adequate potassium',
    ],
  },
  {
    id: 'potato-late-blight',
    name: 'Late Blight',
    crop_type: 'Potato',
    category: 'Fungal',
    image: '/diseases/potato_late_blight.jpg',
    symptoms: [
      'Water-soaked dark lesions spreading rapidly across potato foliage',
      'White fungal sporulation on leaf underside in damp weather',
      'Brown granular rot extending into potato tubers',
    ],
    causes: 'Phytophthora infestans oomycete causing rapid field-wide blighting.',
    management: [
      'Foliar application of Metalaxyl + Mancozeb @ 2.5g/L water',
      'Hill up soil around stems to prevent tuber spore contact',
      'Destroy haulms before harvesting infected plots',
    ],
  },
  {
    id: 'maize-common-rust',
    name: 'Common Rust',
    crop_type: 'Maize',
    category: 'Fungal',
    image: '/diseases/maize_common_rust.jpg',
    symptoms: [
      'Powdery brick-red to cinnamon-brown pustules on both leaf surfaces',
      'Pustules rupture releasing rust-colored fungal spores',
      'Extensive chlorosis and reduced photosynthesis on maize foliage',
    ],
    causes: 'Puccinia sorghi fungus favored by cool, cloudy days and high humidity.',
    management: [
      'Apply Propiconazole 25% EC @ 1ml/L water at early development',
      'Plant resistant corn hybrids with vertical resistance genes',
      'Ensure proper spacing to improve airflow through canopy',
    ],
  },
  {
    id: 'maize-gray-leaf-spot',
    name: 'Gray Leaf Spot',
    crop_type: 'Maize',
    category: 'Fungal',
    image: '/diseases/maize_gray_leaf_spot.jpg',
    symptoms: [
      'Long rectangular tan to gray necrotic lesions strictly parallel to veins',
      'Sharp parallel boundaries bounded by leaf veins',
      'Severe blighting and premature stalk lodging',
    ],
    causes: 'Cercospora zeae-maydis fungus favored by warm temperatures and fog.',
    management: [
      'Foliar application of Strobilurin or Triazole fungicides',
      'Rotate crops out of maize for at least one season',
      'Incorporate residue through tillage where appropriate',
    ],
  },
  {
    id: 'tomato-yellow-curl',
    name: 'Yellow Leaf Curl Virus',
    crop_type: 'Tomato',
    category: 'Viral',
    image: '/diseases/tomato_yellow_leaf_curl.jpg',
    symptoms: [
      'Upward curling and cupping of young tomato leaves',
      'Prominent chlorotic yellow margins on stunted leaflets',
      'Flower drop and complete failure of fruit development',
    ],
    causes: 'Tomato yellow leaf curl virus (TYLCV) vectored by whiteflies.',
    management: [
      'Systemic vector control targeting whiteflies (Imidacloprid/Acetamiprid)',
      'Remove and bag symptomatic infected plants immediately',
      'Use UV-reflective silver mulch in planting beds',
    ],
  },
  {
    id: 'tomato-bacterial-spot',
    name: 'Bacterial Spot',
    crop_type: 'Tomato',
    category: 'Bacterial',
    image: '/diseases/tomato_bacterial_spot.jpg',
    symptoms: [
      'Small, dark brown circular water-soaked spots with yellow halos',
      'Rough, scab-like brown lesions on green tomato fruits',
      'Severe leaf drop leading to sunscald on exposed fruit',
    ],
    causes: 'Xanthomonas perforans bacteria spread via rain splash and handling.',
    management: [
      'Preventive sprays of Copper Hydroxide @ 2.5g/L water',
      'Avoid working in fields while tomato foliage is wet',
      'Treat seeds with hot water or certified pathogen-free stock',
    ],
  },
  {
    id: 'powdery-mildew-general',
    name: 'Powdery Mildew',
    crop_type: 'Multiple Crops',
    category: 'Fungal',
    image: '/diseases/powdery_mildew.jpg',
    symptoms: [
      'White circular patches resembling talcum powder or flour on leaves',
      'Fungal coating spreads across leaves, stems, and buds',
      'Leaves turn yellow, dry up, and drop prematurely',
    ],
    causes: 'Erysiphales fungi thriving in dry weather with moderate humidity.',
    management: [
      'Apply Wettable Sulfur 80% WP @ 3g/L or Potassium Bicarbonate',
      'Spray Hexaconazole 5% EC @ 1ml/L for systemic eradication',
      'Prune inner foliage to improve solar penetration and aeration',
    ],
  },
];

