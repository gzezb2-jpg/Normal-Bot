import discord
from discord.ext import commands
import asyncio
import json
import os
from datetime import datetime, timedelta
import requests

JSONBIN_ID = "696d290043b1c97be93934ed"
JSONBIN_API_KEY = "$2a$10$j9lzn5tqhuvLqZI8dYLwCesE/7r7eLZyms3h6b9U1RfPDsDeB21e2"


intents = discord.Intents.all()
bot = commands.Bot(command_prefix="*", intents=intents)
bot.remove_command("help")

ROLE_WARN_LIMITS = {

    1419358131393138839: 1,

    1419358137093193871: 2,

    1419358144580161596: 3

}

DEFAULT_WARN_LIMIT = 3
MEMBERS_VOICE_ID = 1419358146396160070
BOTS_VOICE_ID = 1419358163429490719
BOOSTS_VOICE_ID = 1419358158010323145


SUPPORT_ROLE_ID = 1419358037990441051
ACCEPT_ROLE_ID = 1462532200237895782
TICKET_CATEGORY_ID = 1462442009875976306
WARN_FILE = "warns.json"


QUESTIONS = [
    "What is your real name?",
    "How old are you?",
    "Why do you want to join our gang?",
    "How many hours do you play per day?",
    "Do you accept the rules?"
]

if not os.path.exists(WARN_FILE):
    with open(WARN_FILE, "w") as f:
        json.dump({}, f)

def load_warns():
    with open(WARN_FILE, "r") as f:
        return json.load(f)

def save_warns(data):
    with open(WARN_FILE, "w") as f:
        json.dump(data, f, indent=4)

def get_token_from_jsonbin():
    url = f"https://api.jsonbin.io/v3/b/{JSONBIN_ID}/latest"
    headers = {
        "X-Master-Key": JSONBIN_API_KEY
    }

    response = requests.get(url, headers=headers)
    data = response.json()
    return data["record"]["DISCORD_TOKEN"]


class ApplyButton(discord.ui.Button):
    def __init__(self):
        super().__init__(
            label="Apply",
            style=discord.ButtonStyle.success,
            custom_id="gang_apply_button"
        )

    async def callback(self, interaction: discord.Interaction):
        guild = interaction.guild
        category = guild.get_channel(TICKET_CATEGORY_ID)

        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),
            interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True),
            guild.get_role(SUPPORT_ROLE_ID): discord.PermissionOverwrite(read_messages=True)
        }

        channel = await guild.create_text_channel(
            name=f"Application-{interaction.user.name}",
            category=category,
            overwrites=overwrites
        )

        await interaction.response.send_message(
            f"Your application ticket has been created: {channel.mention}",
            ephemeral=True
        )

        answers = []

        for question in QUESTIONS:
            await channel.send(question)

            def check(m):
                return m.author == interaction.user and m.channel == channel

            try:
                msg = await bot.wait_for("message", check=check, timeout=300)
                answers.append(msg.content)
            except asyncio.TimeoutError:
                await channel.send("Application timed out.")
                return

        embed = discord.Embed(
            title="Application Summary",
            color=discord.Color.blurple()
        )

        for q, a in zip(QUESTIONS, answers):
            embed.add_field(name=q, value=a, inline=False)

        await channel.send(
            embed=embed,
            view=DecisionView(interaction.user)
        )


class AcceptButton(discord.ui.Button):
    def __init__(self, applicant: discord.Member):
        self.applicant = applicant
        super().__init__(
            label="Accept",
            style=discord.ButtonStyle.success,
            custom_id="application_accept"
        )

    async def callback(self, interaction: discord.Interaction):
        if SUPPORT_ROLE_ID not in [r.id for r in interaction.user.roles]:
            return await interaction.response.send_message(
                "You are not allowed to use this button.",
                ephemeral=True
            )

        role = interaction.guild.get_role(ACCEPT_ROLE_ID)
        await self.applicant.add_roles(role)
        await interaction.channel.send(f"{self.applicant.mention} has been accepted.")
        await applicant.send("Your Application Has Been Accepted You Need To Complete The Interview To Be One Of Us")
        
        

class RefuseButton(discord.ui.Button):
    def __init__(self, applicant: discord.Member):
        self.applicant = applicant
        super().__init__(
            label="Refuse",
            style=discord.ButtonStyle.danger,
            custom_id="application_refuse"
        )

    async def callback(self, interaction: discord.Interaction):
        if SUPPORT_ROLE_ID not in [r.id for r in interaction.user.roles]:
            return await interaction.response.send_message(
                "You are not allowed to use this button.",
                ephemeral=True
            )

        
        await interaction.channel.send(f"{self.applicant.mention} has been refused.")
        await applicant.send("Your Application Has Been Refused")
        

class DecisionView(discord.ui.View):
    def __init__(self, applicant: discord.Member):
        super().__init__(timeout=None)
        self.add_item(AcceptButton(applicant))
        self.add_item(RefuseButton(applicant))

class ApplyView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
        self.add_item(ApplyButton())

async def update_stats(guild):
    members_channel = guild.get_channel(MEMBERS_VOICE_ID)
    bots_channel = guild.get_channel(BOTS_VOICE_ID)
    boosts_channel = guild.get_channel(BOOSTS_VOICE_ID)

    total_members = guild.member_count
    total_bots = len([m for m in guild.members if m.bot])
    total_boosts = guild.premium_subscription_count or 0

    if members_channel:
        await members_channel.edit(name=f"Members: {total_members}")

    if bots_channel:
        await bots_channel.edit(name=f"Bots: {total_bots}")

    if boosts_channel:
        await boosts_channel.edit(name=f"Boosts: {total_boosts}")


@bot.event
async def on_member_join(member):
    await update_stats(member.guild)


@bot.event
async def on_member_remove(member):
    await update_stats(member.guild)


@bot.event
async def on_member_update(before, after):
    if before.premium_since != after.premium_since:
        await update_stats(after.guild)

@bot.event
async def on_ready():
    bot.add_view(ApplyView())
    print("B13 Ftw")
    for guild in bot.guilds:
        await update_stats(guild)
        
    await bot.load_extension("cogs.security")

    await bot.change_presence(
        status=discord.Status.online,
        activity=discord.Streaming(
            name="B13 On Fire 🔥",
            url="https://discord.gg/yS4cfTh4P3"
        )
    )

    voice_channel_id = 1419358198808182865

    voice_channel = bot.get_channel(voice_channel_id)

    if voice_channel and isinstance(voice_channel, discord.VoiceChannel):
        try:
            await voice_channel.connect()
            print(f"Connected to voice channel: {voice_channel.name}")
        except RuntimeError:
            print("Voice disabled (PyNaCl not installed)")
        except Exception as e:
            print(f"Voice error: {e}")
    else:
        print("Voice channel not found or invalid")


@bot.command()
@commands.has_permissions(move_members=True)
async def moveall(ctx):
    if not ctx.author.voice or not ctx.author.voice.channel:
        await ctx.send("You must be in a voice channel.")
        return

    target_channel = ctx.author.voice.channel
    moved = 0

    for vc in ctx.guild.voice_channels:
        for member in vc.members:
            if member != ctx.author:
                try:
                    await member.move_to(target_channel)
                    moved += 1
                except:
                    pass

    await ctx.send(f"Moved {moved} members to {target_channel.name}")

@bot.command()
@commands.has_permissions(administrator=True)
async def applypanel(ctx):
    embed = discord.Embed(
        title="gang Application",
        description="Click the button below to apply.",
        color=discord.Color.red()
    )
    await ctx.send(embed=embed, view=ApplyView())
    
@bot.command()
@commands.has_permissions(administrator=True)
async def unafk(ctx, member: discord.Member = None):

    ch3 = member.voice.channel  

    if member is None:
        return await ctx.send("❌ Specify a user: `!unafk @user`")

    if not member.voice:
        return await ctx.send("❌ That user is not in a voice channel.")

    voice_channels = ctx.guild.voice_channels
    if len(voice_channels) < 2:
        return await ctx.send("❌ Need at least 2 voice channels.")

    ch1 = voice_channels[0]
    ch2 = voice_channels[1]

    await ctx.send(f"🔄 Starting unAFK for {member.mention}...")

    while True:
        if not member.voice:
            await ctx.send(f"⚠️ {member.mention} left voice. Stopping.")
            break

        if member.voice.self_deaf is False:
            await ctx.send(f"✅ {member.mention} undeafened. Stopped.")   
            await member.move_to(ch3)    
            
            break

        try:
            current = member.voice.channel
            await member.move_to(ch2 if current == ch1 else ch1)
        except:
            break

        await asyncio.sleep(4)
  

@bot.command(name='move')
@commands.has_role(1419358162330456248)
async def move(ctx, member: discord.Member, channel: discord.VoiceChannel = None):

    if not channel:

        if ctx.author.voice:

            channel = ctx.author.voice.channel

        else:

            await ctx.send("❌ Please specify a voice channel or join one yourself!")

            return

    if not member.voice:

        await ctx.send(f"❌ {member.mention} is not in a voice channel!")

        return

    if member.voice.channel == channel:

        await ctx.send(f"❌ {member.mention} is already in {channel.mention}!")

        return

    try:

        await member.move_to(channel)

        await ctx.send(f"✅ Moved {member.mention} to {channel.mention}")

    except discord.Forbidden:

        await ctx.send("❌ Missing permissions to move this user!")

    except Exception as e:

        await ctx.send(f"❌ Error moving user: {e}")


@bot.command(name="warn")
@commands.has_permissions(manage_messages=True)
async def warn(ctx, member: discord.Member, *, reason: str = "No reason provided"):
    data = load_warns()
    guild_id = str(ctx.guild.id)
    user_id = str(member.id)

    if guild_id not in data:
        data[guild_id] = {}

    if user_id not in data[guild_id]:
        data[guild_id][user_id] = []

    data[guild_id][user_id].append({
        "moderator": ctx.author.id,
        "reason": reason
    })

    save_warns(data)

    max_warns = DEFAULT_WARN_LIMIT
    for role in member.roles:
        if role.id in ROLE_WARN_LIMITS:
            max_warns = ROLE_WARN_LIMITS[role.id]
            break

    current_warns = len(data[guild_id][user_id])

    await ctx.send(
        f"{member.mention} warned ({current_warns}/{max_warns})\nReason: {reason}"
    )

    if current_warns >= max_warns:
        try:
            await member.timeout(discord.utils.utcnow() + timedelta(minutes=30))
            await ctx.send(f"{member.mention} has been timed out for reaching warn limit")
        except:
            pass

@bot.command(name="warns")
async def warns(ctx, member: discord.Member):
    data = load_warns()
    guild_id = str(ctx.guild.id)
    user_id = str(member.id)

    if guild_id not in data or user_id not in data[guild_id] or len(data[guild_id][user_id]) == 0:
        return await ctx.send(f"{member.mention} has no warnings.")

    warns_list = data[guild_id][user_id]

    description = ""
    for i, warn in enumerate(warns_list, start=1):
        mod = ctx.guild.get_member(warn["moderator"])
        mod_name = mod.mention if mod else "Unknown"
        description += f"{i}. Reason: {warn['reason']} | By: {mod_name}\n"

    embed = discord.Embed(
        title=f"Warnings for {member}",
        description=description,
        color=discord.Color.orange()
    )

    await ctx.send(embed=embed)

@bot.command(name="removewarn")
@commands.has_permissions(manage_messages=True)
async def removewarn(ctx, member: discord.Member):
    data = load_warns()
    guild_id = str(ctx.guild.id)
    user_id = str(member.id)

    if guild_id not in data or user_id not in data[guild_id] or len(data[guild_id][user_id]) == 0:
        return await ctx.send("This user has no warnings.")

    data[guild_id][user_id].pop()

    if len(data[guild_id][user_id]) == 0:
        del data[guild_id][user_id]

    save_warns(data)

    await ctx.send(f"Last warning removed from {member.mention}")
   
@bot.command(name='dmmembers')
@commands.has_permissions(administrator=True)
async def dmmembers(ctx, *, message: str):
    role_id = 1419358162330456248
    role = discord.utils.get(ctx.guild.roles, id=role_id)
    
    if not role:
        await ctx.send("❌ Role not found!")
        return

    sent_count = 0
    failed_count = 0

    for member in role.members:
        try:
            embed = discord.Embed(
                title="✉️ Members Message",
                description=message,
                color=discord.Color.yellow(),
                timestamp=datetime.now()
            )
            embed.add_field(name="From", value=ctx.author.mention, inline=False)
            embed.add_field(name="To", value=member.mention, inline=False)
            embed.add_field(name="Server", value=ctx.guild.name, inline=False)
            
            await member.send(embed=embed)
            sent_count += 1
        except discord.Forbidden:
            failed_count += 1
        except Exception as e:
            print(f"Error sending DM to {member}: {e}")
            failed_count += 1

    await ctx.send(f"✅ Successfully sent DMs to {sent_count} Gang members. Failed: {failed_count}")


TOKEN = get_token_from_jsonbin()

bot.run(TOKEN)