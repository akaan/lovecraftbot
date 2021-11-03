import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { Inject } from "typescript-ioc";
import { CardOfTheDayService } from "../services/CardOfTheDayService";

export class CardOfTheDayCommand implements ICommand {
  admin = true;
  aliases = ["cotd"];
  help =
    "Ajoute les codes de cartes précisés à la liste des cartes déjà tirées";

  @Inject private cardOfTheDayService!: CardOfTheDayService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message, args } = cmdArgs;

    const codes = args.split(",").map((s) => s.trim());
    await this.cardOfTheDayService.addCardSent(codes);
    await message.reply(
      `Ces ${codes.length} carte(s) ont été ajoutées à la liste des cartes déjà tirées`
    );

    return { resultString: "CardOfTheDayCommand: Codes ajoutés" };
  }
}
