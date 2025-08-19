'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import ReportingFolderHandler from '../../../../src/service/reportingFolderHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles, readDirs } from '../../../../src/utils/fsHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('../../../../src/utils/fsHelper')
const mockedReadDirs = jest.mocked(readDirs)

const entity = 'folder/test'
const extension = 'report'
const objectType = {
  directoryName: 'reports',
  inFolder: true,
  metaFile: true,
  xmlName: 'Report',
  content: [
    {
      suffix: 'report',
      xmlName: 'Report',
    },
    {
      suffix: 'reportFolder',
      xmlName: 'ReportFolder',
    },
  ],
}

const testContext = [
  [
    `A       force-app/main/default/${objectType.directoryName}/${entity}.${extension}-meta.xml`,
    new Set([entity]),
    'Report',
  ],
  [
    `A       force-app/main/default/${objectType.directoryName}/${entity}.reportFolder-meta.xml`,
    new Set([entity]),
    'ReportFolder',
  ],
  [
    `A       force-app/main/default/${objectType.directoryName}/folder/${entity}.reportFolder-meta.xml`,
    new Set([`folder/${entity}`]),
    'ReportFolder',
  ],
  [
    `A       force-app/main/default/${objectType.directoryName}/folder/folder/${entity}.reportFolder-meta.xml`,
    new Set([`folder/folder/${entity}`]),
    'ReportFolder',
  ],
]

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('InNestedFolderHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getGlobalMetadata()
  })

  describe.each(testContext)(
    'when called with generateDelta false',
    (
      changePath: string | Set<string>,
      expected: string | Set<string>,
      expectedType: string | Set<string>
    ) => {
      beforeEach(() => {
        work.config.generateDelta = false
      })
      it(`should not copy meta files nor copy special extension when adding ${expectedType}`, async () => {
        // Arrange
        const sut = new ReportingFolderHandler(
          changePath as string,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(work.diffs.package.get(expectedType as string)).toEqual(expected)
        expect(copyFiles).not.toHaveBeenCalled()
      })
    }
  )

  describe.each(testContext)(
    'when called with generateDelta true',
    (
      changePath: string | Set<string>,
      expected: string | Set<string>,
      expectedType: string | Set<string>
    ) => {
      beforeEach(() => {
        work.config.generateDelta = true
      })

      describe(`when readDirs does not return files`, () => {
        it(`should not copy special extension and copy meta files in addition ${expectedType}`, async () => {
          // Arrange
          const sut = new ReportingFolderHandler(
            changePath as string,
            objectType,
            work,
            globalMetadata
          )
          mockedReadDirs.mockImplementation(() => Promise.resolve([]))

          // Act
          await sut.handleAddition()

          // Assert
          expect(work.diffs.package.get(expectedType as string)).toEqual(
            expected
          )
          expect(readDirs).toHaveBeenCalledTimes(1)
          expect(copyFiles).toHaveBeenCalledTimes(3)
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            expect.stringContaining(METAFILE_SUFFIX)
          )
        })
      })

      describe('when readDirs returns files', () => {
        it('should copy special extension', async () => {
          // Arrange
          const sut = new ReportingFolderHandler(
            changePath as string,
            objectType,
            work,
            globalMetadata
          )
          mockedReadDirs.mockImplementationOnce(() =>
            Promise.resolve([entity, 'not/matching'])
          )

          // Act
          await sut.handleAddition()

          // Assert
          expect(work.diffs.package.get(expectedType as string)).toEqual(
            expected
          )
          expect(readDirs).toHaveBeenCalledTimes(1)
          expect(copyFiles).toHaveBeenCalledTimes(5)
        })
      })
    }
  )

  describe('when the line should not be processed', () => {
    it.each([
      `force-app/main/default/${objectType.directoryName}/test.otherExtension`,
    ])('does not handle the line', async entityPath => {
      // Arrange
      const sut = new ReportingFolderHandler(
        `A       ${entityPath}`,
        objectType,
        work,
        globalMetadata
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.size).toBe(0)
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })
})
