import { ApplicationCommandMessage } from "@fire/lib/extensions/appcommandmessage";
import { CommandInteraction } from "@fire/lib/extensions/commandinteraction";
import { ComponentMessage } from "@fire/lib/extensions/componentmessage";
import { ContextCommandMessage } from "@fire/lib/extensions/contextcommandmessage";
import { FireGuild } from "@fire/lib/extensions/guild";
import { FireUser } from "@fire/lib/extensions/user";
import { IPoint } from "@fire/lib/interfaces/aether";
import { constants } from "@fire/lib/util/constants";
import { GuildTagManager } from "@fire/lib/util/guildtagmanager";
import { Listener } from "@fire/lib/util/listener";
import {
  ContextMenuInteraction,
  Interaction,
  MessageComponentInteraction,
} from "discord.js";

const { emojis } = constants;

export default class InteractionListener extends Listener {
  constructor() {
    super("interaction", {
      emitter: "client",
      event: "interactionCreate",
    });
  }

  async exec(interaction: Interaction) {
    if (this.blacklistCheck(interaction)) return;
    const point: IPoint = {
      measurement: "interaction",
      tags: {
        type: interaction.type,
        user_id: interaction.user?.id,
        cluster: this.client.manager.id.toString(),
        shard: interaction.guild?.shardId.toString() ?? "0",
      },
      fields: {
        guild: interaction.guild
          ? `${interaction.guild.name} (${interaction.guildId})`
          : "N/A",
        user: `${interaction.user} (${interaction.user.id})`,
      },
    };
    if (interaction.isCommand()) {
      point.fields.command = interaction.commandName;
      point.fields.args = JSON.stringify(interaction.options.data);
    } else if (interaction.isMessageComponent()) {
      point.fields.custom_id = interaction.customId;
      point.fields.component_type = interaction.componentType;
    } else if (interaction.isContextMenu()) {
      point.tags.type = "CONTEXT_COMMAND";
      point.fields.command = interaction.commandName;
      point.fields.context = interaction.targetType;
      point.fields.target_id = interaction.targetId;
    }
    this.client.influx([point]);
    if (interaction.isCommand())
      return await this.handleApplicationCommand(
        interaction as CommandInteraction
      );
    else if (interaction.isContextMenu())
      return await this.handleContextMenu(interaction);
    else if (interaction.isButton())
      return await this.handleButton(interaction);
    else if (interaction.isSelectMenu())
      return await this.handleSelect(interaction);
  }

  async handleApplicationCommand(command: CommandInteraction) {
    try {
      // should be cached if in guild or fetch if dm channel
      await this.client.channels.fetch(command.channelId).catch(() => {});
      if (command.guild && !command.guild?.tags) {
        command.guild.tags = new GuildTagManager(this.client, command.guild);
        await command.guild.tags.init();
      }
      const message = new ApplicationCommandMessage(this.client, command);
      await message.channel.ack((message.flags & 64) != 0);
      if (!message.command) {
        this.client.console.warn(
          `[Commands] Got slash command request for unknown command, /${command.commandName}`
        );
        return await message.error("UNKNOWN_COMMAND");
      } else if (!message.guild && message.command.channel == "guild")
        return await message.error("SLASH_COMMAND_BOT_REQUIRED", {
          invite: this.client.config.inviteLink,
        });
      await message.generateContent();
      // @ts-ignore
      await this.client.commandHandler.handle(message);
      // if (message.sent != "message")
      //   await message.sourceMessage?.delete().catch(() => {});
    } catch (error) {
      const guild = this.client.guilds.cache.get(command.guildId);
      if (!guild)
        await this.error(command, error).catch(() => {
          command.reply(`${emojis.error} Something went wrong...`);
        });
      if (typeof this.client.sentry != "undefined") {
        const sentry = this.client.sentry;
        sentry.setExtras({
          slashCommand: JSON.stringify(command, (_, value) =>
            typeof value === "bigint" ? `${value}n` : value
          ),
          member: command.member
            ? `${command.member.user.username}#${command.member.user.discriminator}`
            : `${command.user.username}#${command.user.discriminator}`,
          channel_id: command.channelId,
          guild_id: command.guildId,
          env: process.env.NODE_ENV,
        });
        sentry.captureException(error);
        sentry.setExtras(null);
        sentry.setUser(null);
      }
    }
  }

  async handleButton(button: MessageComponentInteraction) {
    try {
      // should be cached if in guild or fetch if dm channel
      await this.client.channels.fetch(button.channelId).catch(() => {});
      const message = new ComponentMessage(this.client, button);
      if (message.customId.startsWith("?")) await message.channel.defer(true);
      if (
        !message.customId.startsWith("!") &&
        !message.customId.startsWith("?")
      )
        await message.channel.ack();
      else message.customId = message.customId.slice(1);
      this.client.emit("button", message);
      if (!message.message) await message.getRealMessage().catch(() => {});
    } catch (error) {
      await this.error(button, error).catch(() => {
        button.reply(`${emojis.error} Something went wrong...`);
      });
      if (typeof this.client.sentry != "undefined") {
        const sentry = this.client.sentry;
        sentry.setExtras({
          button: JSON.stringify(button),
          member: button.member
            ? `${button.member.user.username}#${button.member.user.discriminator}`
            : `${button.user.username}#${button.user.discriminator}`,
          channel_id: button.channelId,
          guild_id: button.guildId,
          env: process.env.NODE_ENV,
        });
        sentry.captureException(error);
        sentry.setExtras(null);
        sentry.setUser(null);
      }
    }
  }

  async handleSelect(select: MessageComponentInteraction) {
    try {
      // should be cached if in guild or fetch if dm channel
      await this.client.channels.fetch(select.channelId).catch(() => {});
      const message = new ComponentMessage(this.client, select);
      if (!message.customId.startsWith("!")) await message.channel.ack();
      else message.customId = message.customId.slice(1);
      this.client.emit("select", message);
    } catch (error) {
      await this.error(select, error).catch(() => {
        select.reply(`${emojis.error} Something went wrong...`);
      });
      if (typeof this.client.sentry != "undefined") {
        const sentry = this.client.sentry;
        sentry.setExtras({
          button: JSON.stringify(select),
          member: select.member
            ? `${select.member.user.username}#${select.member.user.discriminator}`
            : `${select.user.username}#${select.user.discriminator}`,
          channel_id: select.channelId,
          guild_id: select.guildId,
          env: process.env.NODE_ENV,
        });
        sentry.captureException(error);
        sentry.setExtras(null);
        sentry.setUser(null);
      }
    }
  }

  async handleContextMenu(context: ContextMenuInteraction) {
    try {
      // should be cached if in guild or fetch if dm channel
      await this.client.channels.fetch(context.channelId).catch(() => {});
      const message = new ContextCommandMessage(this.client, context);
      await message.channel.ack((message.flags & 64) != 0);
      if (!message.command) {
        this.client.console.warn(
          `[Commands] Got application command request for unknown context menu, ${context.commandName}`
        );
        return await message.error("UNKNOWN_COMMAND");
      } else if (!message.guild && message.command.channel == "guild")
        return await message.error("SLASH_COMMAND_BOT_REQUIRED", {
          invite: this.client.config.inviteLink,
        });
      await message.generateContent();
      // @ts-ignore
      await this.client.commandHandler.handle(message);
      // if (message.sent != "message")
      //   await message.sourceMessage?.delete().catch(() => {});
    } catch (error) {
      const guild = this.client.guilds.cache.get(context.guildId);
      if (!guild)
        await this.error(context, error).catch(() => {
          context.reply(`${emojis.error} Something went wrong...`);
        });
      if (typeof this.client.sentry != "undefined") {
        const sentry = this.client.sentry;
        sentry.setExtras({
          contextCommand: JSON.stringify(context),
          member: context.member
            ? `${context.member.user.username}#${context.member.user.discriminator}`
            : `${context.user.username}#${context.user.discriminator}`,
          channel_id: context.channelId,
          guild_id: context.guildId,
          env: process.env.NODE_ENV,
        });
        sentry.captureException(error);
        sentry.setExtras(null);
        sentry.setUser(null);
      }
    }
  }

  async error(
    interaction:
      | CommandInteraction
      | ContextMenuInteraction
      | MessageComponentInteraction,
    error: Error
  ) {
    return interaction.reply({
      content: `${emojis.error} An error occured while trying to handle this interaction that may be caused by being in DMs or the bot not being present...

      If this is a slash command, try inviting the bot to a server (<${this.client.config.inviteLink}>) if you haven't already and try again.

      Error Message: ${error.message}`,
      ephemeral: true,
    });
  }

  blacklistCheck(interaction: Interaction) {
    const guild = interaction.guild as FireGuild;
    const user = interaction.user as FireUser;

    return this.client.util.isBlacklisted(
      user,
      guild,
      interaction.isCommand() ? interaction.commandName : null
    );
  }
}
