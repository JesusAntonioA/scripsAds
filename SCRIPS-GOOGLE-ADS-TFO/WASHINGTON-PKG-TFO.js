// Configuración de la campaña y grupo de anuncios
const CAMPAIGN_NAME = 'WASHINGTON-PKG-TFO';
const AD_GROUP_NAME = 'TFO-WASHINGTON-ESTANDAR';
const JSON_URL = 'https://www.reservhotel.com/hotel_air_tools/10818.json';

// Función principal para actualizar el anuncio
function main() {
  const response = UrlFetchApp.fetch(JSON_URL);
  const json = JSON.parse(response.getContentText());
  const offers = json.hotel.lowestFares;

  const filteredOffers = offers.filter(offer => offer.departure === 'DCA');

  if (filteredOffers.length > 0) {
    const adText = createAdText(filteredOffers[0]); // Solo usaremos la primera oferta filtrada

    const adGroupIterator = AdsApp.adGroups()
      .withCondition(`Name = '${AD_GROUP_NAME}'`)
      .withCondition(`CampaignName = '${CAMPAIGN_NAME}'`)
      .get();
    
    if (adGroupIterator.hasNext()) {
      const adGroup = adGroupIterator.next();
      const existingAds = getExistingAds(adGroup);

      if (existingAds.length > 0) {
        const existingAd = existingAds[0];
        
        if (!isAdUpToDate(existingAd, adText)) {
          // Eliminar todos los anuncios existentes
          existingAds.forEach(ad => {
            ad.ad.remove();
            Logger.log('Successfully removed existing ad');
          });

          // Crear nuevo anuncio
          try {
            createResponsiveSearchAd(adGroup, adText);
            Logger.log('Successfully created ad for departure: ' + adText.departure);
          } catch (e) {
            Logger.log('Failed to create ad for departure: ' + adText.departure + '. Error: ' + e.message);
          }
        } else {
          Logger.log('No changes detected. Ad is up to date.');
        }
      } else {
        // Crear nuevo anuncio si no hay anuncios existentes
        try {
          createResponsiveSearchAd(adGroup, adText);
          Logger.log('Successfully created ad for departure: ' + adText.departure);
        } catch (e) {
          Logger.log('Failed to create ad for departure: ' + adText.departure + '. Error: ' + e.message);
        }
      }
    } else {
      Logger.log('Ad group not found: ' + AD_GROUP_NAME);
    }
  } else {
    Logger.log('No offers found for the specified departure airport.');
  }
}

// Función para obtener anuncios existentes en el grupo de anuncios
function getExistingAds(adGroup) {
  const ads = [];
  const adIterator = adGroup.ads().withCondition('Type = RESPONSIVE_SEARCH_AD').get();

  while (adIterator.hasNext()) {
    const ad = adIterator.next();
    const headlines = [];
    const descriptions = [];

    for (let i = 1; i <= 15; i++) {
      try {
        const headline = ad['getHeadlinePart' + i]();
        if (headline) {
          headlines.push(headline);
        }
      } catch (e) {
        // Continuar si la función no existe
        continue;
      }
    }

    for (let i = 1; i <= 4; i++) {
      try {
        const description = ad['getDescription' + i]();
        if (description) {
          descriptions.push(description);
        }
      } catch (e) {
        // Continuar si la función no existe
        continue;
      }
    }

    ads.push({
      ad: ad,
      headlines: headlines,
      descriptions: descriptions,
      finalUrl: ad.urls().getFinalUrl(),
      departureDate: extractDateFromText(headlines[3] || ""), // Asumiendo que la fecha está en la cuarta línea del headline
      returnDate: extractDateFromText(descriptions[0] || ""), // Asumiendo que la fecha está en la primera línea de la descripción
      cost: extractCostFromText(headlines[2] || "") // Asumiendo que el costo está en la tercera línea del headline
    });
  }

  return ads;
}

// Función para verificar si un anuncio está actualizado
function isAdUpToDate(existingAd, newAdText) {
  return (
    existingAd.headlines.every((headline, index) => headline === newAdText.headlines[index]) &&
    existingAd.descriptions.every((description, index) => description === newAdText.descriptions[index]) &&
    existingAd.finalUrl === newAdText.finalUrl
  );
}

// Función para crear el texto del anuncio
function createAdText(offer) {
  const departure = offer.departure_airport_name.split(' ')[0]; // Toma solo la primera palabra
  const departureDate = offer.departureDate;
  const returnDate = offer.returnDate;
  const cost = offer.cost;
  return {
    departure: offer.departure, // Para fines de logging
    departureDate: departureDate,
    returnDate: returnDate,
    cost: cost,
    headlines: [
      truncateText(`Fly from Washington to Cancun`, 30),
      truncateText(`Flights from $${cost}`, 30),
      truncateText(`Stay at The Fives Downtown`, 30),
      truncateText(`Dates: ${formatDateRange(departureDate)}`, 30),
      truncateText(`Today's best rate $${cost}`, 30), 
      truncateText(`Enjoy from Playa del Carmen`, 30),
      truncateText(`Book today from $${cost}`, 30),
      truncateText(`Fly since ${formatDateRange  ( departureDate)}`, 30),
      truncateText(`Hotel + Flight from $${cost}`, 30),
      truncateText(`The Fives Downtown`, 30),
      truncateText(`Exclusive Packages `, 30),
      truncateText(`Caribbean Vacation Packages`, 30),
      truncateText(`Book Now from $${cost}`, 30),
      truncateText(`Book Today`, 30),
      truncateText(`Best Package Deals`, 30),
    ],
    descriptions: [
      truncateText(`Flight from Washington to Cancun from $${cost}. Book Today!`, 90),
      truncateText(`Enjoy a stay at The Fives Downtow Hotel + Flight  from $${cost}`, 90),
      truncateText(`Book Now and Get the Best Rate: Flight + Hotel by The Fives Downtown`, 90),
    ],
    finalUrl: offer.booking_url
  };
}

// Función para extraer la fecha del texto
function extractDateFromText(text) {
  const datePattern = /\b\w{3} \d{1,2}\b/g; // Ejemplo: "Jan 1"
  const matches = text.match(datePattern);
  return matches ? matches[0] : null;
}

// Función para extraer el costo del texto
function extractCostFromText(text) {
  const costPattern = /\$\d+(\.\d{1,2})?/g; // Ejemplo: "$123.45"
  const matches = text.match(costPattern);
  return matches ? matches[0].replace('$', '') : null;
}

// Función para truncar texto
function truncateText(text, maxLength) {
  return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
}

// Función para formatear fechas
function formatDateRange(departureDate) {
  const options = { month: '2-digit', day: '2-digit' }; // Formato MM-DD
  const departure = new Date(departureDate).toLocaleDateString('en-US', options);
  return departure;
}

// Función para crear un anuncio responsivo
function createResponsiveSearchAd(adGroup, adText) {
  let builder = adGroup.newAd().responsiveSearchAdBuilder();
  adText.headlines.forEach(headline => {
    builder = builder.addHeadline(headline);
  });
  adText.descriptions.forEach(description => {
    builder = builder.addDescription(description);
  });
  builder.withFinalUrl(adText.finalUrl).build();
}
