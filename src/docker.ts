import Docker from "dockerode"
import os from "os"
import { Language, DEFAULT_IMAGES } from "./language.js"

interface RunResult {
  success: boolean
  code: number
  stdout: string
  stderr: string
}

const DOCKER_SOCKET_PATHS: Record<string, string> = {
  darwin: "/var/run/docker.sock",
  linux: "/var/run/docker.sock",
  win32: "\\\\.\\pipe\\docker_engine",
}

const getDockerSocketPath = (): string => {
  const platform = os.platform()
  const socketPath = DOCKER_SOCKET_PATHS[platform]
  if (!socketPath) {
    throw new Error(`Unsupported platform: ${platform}`)
  }
  return socketPath
}

const createDockerClient = (): Docker =>
  new Docker({ socketPath: getDockerSocketPath() })

const docker = createDockerClient()

const ensureImageExists = async (image: string): Promise<void> => {
  try {
    const images = await docker.listImages()
    if (!images.some((img) => img.RepoTags?.includes(image))) {
      await new Promise((resolve, reject) => {
        docker.pull(image, {}, (err) => (err ? reject(err) : resolve(null)))
      })
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Reduced timeout
    }
  } catch (err) {
    throw new Error(
      `Failed to ensure image ${image}: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }
}

const EXECUTION_COMMANDS: Record<Language, (code: string) => string[]> = {
  python: (code) => ["python", "-c", code],
  javascript: (code) => ["node", "-e", code],
  typescript: (code) => ["node", "-e", code],
  go: (code) => [
    "sh",
    "-c",
    `echo "${code.replace(/"/g, '\\"')}" > /tmp/code.go && go run /tmp/code.go`,
  ],
  java: (code) => [
    "sh",
    "-c",
    `echo "${code.replace(
      /"/g,
      '\\"'
    )}" > /tmp/Main.java && javac /tmp/Main.java && java -cp /tmp Main`,
  ],
  c: (code) => [
    "sh",
    "-c",
    `echo "${code.replace(
      /"/g,
      '\\"'
    )}" > /tmp/code.c && gcc /tmp/code.c -o /tmp/a.out && /tmp/a.out`,
  ],
  cpp: (code) => [
    "sh",
    "-c",
    `echo "${code.replace(
      /"/g,
      '\\"'
    )}" > /tmp/code.cpp && g++ /tmp/code.cpp -o /tmp/a.out && /tmp/a.out`,
  ],
}

const getExecutionCommand = (language: Language, code: string): string[] => {
  const command = EXECUTION_COMMANDS[language]
  if (!command) {
    throw new Error(`Unsupported language: ${language}`)
  }
  return command(code)
}

export const run = async (
  code: string,
  language: Language
): Promise<RunResult> => {
  const image = DEFAULT_IMAGES[language]
  const cmd = getExecutionCommand(language, code)
  let container: Docker.Container | null = null

  try {
    await ensureImageExists(image)

    const createOptions = {
      Image: image,
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        AutoRemove: false,
        Memory: 256 * 1024 * 1024,
        MemorySwap: 512 * 1024 * 1024,
        CpuShares: 512,
        NetworkMode: "none",
      },
    }

    container = await docker.createContainer(createOptions)

    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    })

    const stdout: string[] = []
    const stderr: string[] = []
    container.modem.demuxStream(
      stream,
      { write: (chunk: Buffer) => stdout.push(chunk.toString()) },
      { write: (chunk: Buffer) => stderr.push(chunk.toString()) }
    )

    await container.start()

    const execResult = await container.wait()

    return {
      success: execResult.StatusCode === 0,
      code: execResult.StatusCode,
      stdout: stdout.join(""),
      stderr: stderr.join(""),
    }
  } catch (error) {
    throw new Error(
      `Execution failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  } finally {
    if (container) {
      try {
        await container.remove({ force: true })
      } catch (cleanupError) {
        console.error(
          `Cleanup failed: ${
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError)
          }`
        )
      }
    }
  }
}
