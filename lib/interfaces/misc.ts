import { NewsChannel, ThreadChannel, DMChannel, Snowflake } from "discord.js";
import { ApplicationCommandMessage } from "../extensions/appcommandmessage";
import { ContextCommandMessage } from "../extensions/contextcommandmessage";
import { ComponentMessage } from "../extensions/componentmessage";
import { FireTextChannel } from "../extensions/textchannel";
import { FireGuild } from "../extensions/guild";
import { Fire } from "../Fire";

// basefakechannel more like basedfakechannel amirite
export class BaseFakeChannel {
  get name(): string {
    return "";
  }
  message: ApplicationCommandMessage | ContextCommandMessage | ComponentMessage;
  real: FireTextChannel | NewsChannel | ThreadChannel | DMChannel;
  interactionId: Snowflake;
  guild?: FireGuild;
  token: string;
  id: Snowflake;
  client: Fire;
}
