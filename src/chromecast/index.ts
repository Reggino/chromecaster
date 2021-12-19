import bonjour from "bonjour";

interface IChromecast {
  ip: string;
  name: string;
  location: string;
  type: string;
}

export async function initialize(name?: string) {
  console.log("Looking for chromecasts");
  return new Promise((resolve, reject) => {
    const chromecasts: IChromecast[] = [];

    const timeout = setTimeout(() => {
      if (!chromecasts.length) {
        reject(new Error(`No chromecast found on the network`));
        return;
      }
      if (name) {
        const chromecast = chromecasts.find(
          (chromecast) => chromecast.name === name
        );
        if (chromecast) {
          resolve(chromecast);
          return;
        }
        reject(new Error(`Could not find chromecast: ${name}`));
        return;
      }
      if (chromecasts.length === 1) {
        resolve(chromecasts[0]);
      }
      reject(
        new Error(
          `Multiple chromecasts found. Please select ${chromecasts
            .map((chromecast) => `"${chromecast.name}"`)
            .join(" or ")} using -c argument.`
        )
      );
    }, 1000);


    bonjour().find({ type: "googlecast" }, (service) => {
      console.log(
        `Found chromecast: ${JSON.stringify(
          { ...service, rawTxt: undefined },
          null,
          "\t"
        )}`
      );
      const newChromecast = {
        ip: service.addresses[0],
        name: service.name,
        location: service.txt.fn,
        type: service.txt.md,
      };
      if (name === service.name) {
        clearTimeout(timeout);
        resolve(newChromecast);
        return;
      }
      chromecasts.push(newChromecast);
    });
  });
}
