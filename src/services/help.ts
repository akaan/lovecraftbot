import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";
import { BaseService } from "../base/BaseService";

interface HelpText {
  command: string;
  aliases: string[];
  help: string;
}

@Singleton
@OnlyInstantiableByContainer
export class HelpService extends BaseService {
  public name = "HelpService";

  public get allHelp(): HelpText[] {
    return this.helpTexts;
  }

  private helpTexts: HelpText[] = [];

  public addHelp(help: HelpText): void {
    this.helpTexts.push(help);
  }
}
