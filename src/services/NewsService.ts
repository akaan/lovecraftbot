import axios from "axios";
import { Client } from "discord.js";
import { JSDOM } from "jsdom";
import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

@Singleton
@OnlyInstantiableByContainer
export class NewsService extends BaseService {
  public async init(client: Client) {
    await super.init(client);
  }

  public async getLatestArkhamHorrorLCGNews(): Promise<string | undefined> {
    try {
      const baseUrl = `https://www.fantasyflightgames.com`;
      const url = `${baseUrl}/en/news/tag/arkham-horror-the-card-game/?`;
      const response = await axios.get<string>(url);
      const { document } = new JSDOM(response.data).window;
      const firstLinkElem = document.querySelector(
        ".blog-list > .blog-item > .blog-text > h1 > a"
      );
      if (firstLinkElem) {
        return `${baseUrl}${firstLinkElem.getAttribute("href") || ""}`;
      }
    } catch (err) {
      return;
    }
  }
}
