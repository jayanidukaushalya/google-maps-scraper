import { Places } from "../constants";

const buildGoogleMapsURL = ({
  searchKey,
  coordinates,
}: {
  searchKey: string | Places;
  coordinates?: { latitude: number; longitude: number };
}) => {
  const baseUrl = "https://www.google.com/maps/search/";
  const query = encodeURIComponent(searchKey);
  const location = coordinates
    ? `/@${coordinates.latitude},${coordinates.longitude},15z`
    : "";

  return `${baseUrl}${query}${location}`;
};

export default buildGoogleMapsURL;
