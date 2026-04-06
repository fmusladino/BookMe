/**
 * Convierte un slug (ejemplo: "medico-general") en texto formateado
 * "medico-general" -> "Médico General"
 */
export function unslugify(slug: string): string {
  const specialtyMap: Record<string, string> = {
    'medico-general': 'Médico General',
    'odontologo': 'Odontólogo',
    'psicologo': 'Psicólogo',
    'nutricionista': 'Nutricionista',
    'kinesiologo': 'Kinesiólogo',
    'dermatologo': 'Dermatólogo',
    'pediatra': 'Pediatra',
    'ginecologo': 'Ginecólogo',
    'peluquero': 'Peluquero',
    'barbero': 'Barbero',
    'entrenador-personal': 'Entrenador Personal',
    'coach': 'Coach',
  };

  // Retorna el nombre formateado si existe en el mapa, si no, capitaliza cada palabra
  if (specialtyMap[slug]) {
    return specialtyMap[slug];
  }

  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Convierte un slug de ciudad (ejemplo: "buenos-aires") en texto formateado
 * "buenos-aires" -> "Buenos Aires"
 */
export function unslugifyCity(slug: string): string {
  const cityMap: Record<string, string> = {
    'buenos-aires': 'Buenos Aires',
    'caba': 'CABA',
    'rosario': 'Rosario',
    'cordoba': 'Córdoba',
    'mendoza': 'Mendoza',
    'tucuman': 'Tucumán',
    'la-plata': 'La Plata',
    'mar-del-plata': 'Mar del Plata',
    'salta': 'Salta',
    'santa-fe': 'Santa Fe',
  };

  if (cityMap[slug]) {
    return cityMap[slug];
  }

  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Retorna todas las ciudades y especialidades para generateStaticParams
 */
export function getAllCitySpecialtyCombinations() {
  const cities = [
    'buenos-aires',
    'caba',
    'rosario',
    'cordoba',
    'mendoza',
    'tucuman',
    'la-plata',
    'mar-del-plata',
    'salta',
    'santa-fe',
  ];

  const specialties = [
    'medico-general',
    'odontologo',
    'psicologo',
    'nutricionista',
    'kinesiologo',
    'dermatologo',
    'pediatra',
    'ginecologo',
    'peluquero',
    'barbero',
    'entrenador-personal',
    'coach',
  ];

  const combinations = [];
  for (const city of cities) {
    for (const specialty of specialties) {
      combinations.push({
        city,
        specialty,
      });
    }
  }

  return combinations;
}
