import { ExperimentInterfaceStringDates } from "back-end/types/experiment";
import { IdeaInterface } from "back-end/types/idea";
import { VisualChangesetInterface } from "back-end/types/visual-changeset";
import { FeatureInterface } from "back-end/types/feature";
import {
  MatchingRule,
  getMatchingRules,
  includeExperimentInPayload,
} from "shared/util";
import { useEffect, useMemo, useState } from "react";
import { FaChartBar } from "react-icons/fa";
import clsx from "clsx";
import { getDemoDatasourceProjectIdForOrganization } from "shared/demo-datasource";
import { useRouter } from "next/router";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useEnvironments, useFeaturesList } from "@/services/features";
import FeatureFromExperimentModal from "@/components/Features/FeatureModal/FeatureFromExperimentModal";
import Modal from "@/components/Modal";
import HistoryTable from "@/components/HistoryTable";
import { openVisualEditor } from "@/components/OpenVisualEditorLink";
import useApi from "@/hooks/useApi";
import { useUser } from "@/services/UserContext";
import useSDKConnections from "@/hooks/useSDKConnections";
import DiscussionThread from "@/components/DiscussionThread";
import { useAuth } from "@/services/auth";
import { DeleteDemoDatasourceButton } from "@/components/DemoDataSourcePage/DemoDataSourcePage";
import { phaseSummary } from "@/services/utils";
import EditStatusModal from "../EditStatusModal";
import VisualChangesetModal from "../VisualChangesetModal";
import EditExperimentNameForm from "../EditExperimentNameForm";
import { useSnapshot } from "../SnapshotProvider";
import ExperimentHeader from "./ExperimentHeader";
import ProjectTagBar from "./ProjectTagBar";
import SetupTabOverview from "./SetupTabOverview";
import Implementation from "./Implementation";
import ResultsTab from "./ResultsTab";
import StoppedExperimentBanner from "./StoppedExperimentBanner";

const experimentTabs = ["overview", "results"] as const;
export type ExperimentTab = typeof experimentTabs[number];

export type LinkedFeature = {
  feature: FeatureInterface;
  rules: MatchingRule[];
};

export interface Props {
  experiment: ExperimentInterfaceStringDates;
  mutate: () => void;
  duplicate?: (() => void) | null;
  editTags?: (() => void) | null;
  editProject?: (() => void) | null;
  idea?: IdeaInterface;
  editVariations?: (() => void) | null;
  visualChangesets: VisualChangesetInterface[];
  newPhase?: (() => void) | null;
  editPhases?: (() => void) | null;
  editPhase?: ((i: number | null) => void) | null;
  editTargeting?: (() => void) | null;
  editMetrics?: (() => void) | null;
  editResult?: (() => void) | null;
}

export default function TabbedPage({
  experiment,
  mutate,
  duplicate,
  editProject,
  editTags,
  idea,
  editVariations,
  visualChangesets,
  editPhases,
  editTargeting,
  newPhase,
  editMetrics,
  editResult,
}: Props) {
  const [tab, setTab] = useLocalStorage<ExperimentTab>(
    `tabbedPageTab__${experiment.id}`,
    "overview"
  );

  const router = useRouter();

  const { apiCall } = useAuth();

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [auditModal, setAuditModal] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [watchersModal, setWatchersModal] = useState(false);
  const [visualEditorModal, setVisualEditorModal] = useState(false);
  const [featureModal, setFeatureModal] = useState(false);

  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace(/^#/, "") as ExperimentTab;
      if (experimentTabs.includes(hash)) {
        setTab(hash);
      }
    };
    handler();
    window.addEventListener("hashchange", handler, false);
    return () => window.removeEventListener("hashchange", handler, false);
  }, [setTab]);

  const { phase, setPhase } = useSnapshot();
  const viewingOldPhase =
    experiment.phases.length > 0 && phase < experiment.phases.length - 1;

  const setTabAndScroll = (tab: ExperimentTab) => {
    setTab(tab);
    const newUrl = window.location.href.replace(/#.*/, "") + "#" + tab;
    if (newUrl === window.location.href) return;
    window.history.pushState("", "", newUrl);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const { features, mutate: mutateFeatures } = useFeaturesList(false);
  const environments = useEnvironments();

  const { linkedFeatures, legacyFeatures } = useMemo(() => {
    const environmentIds = environments.map((e) => e.id);

    const linkedFeatures: LinkedFeature[] = [];
    const legacyFeatures: LinkedFeature[] = [];

    features.forEach((feature) => {
      const refRules = getMatchingRules(
        feature,
        (rule) =>
          rule.type === "experiment-ref" && rule.experimentId === experiment.id,
        environmentIds
      );
      if (refRules.length > 0) {
        linkedFeatures.push({ feature, rules: refRules });
        return;
      }

      const legacyRules = getMatchingRules(
        feature,
        (rule) =>
          rule.type === "experiment" &&
          (rule.trackingKey || feature.id) === experiment.trackingKey,
        environmentIds
      );
      if (legacyRules.length > 0) {
        legacyFeatures.push({ feature, rules: legacyRules });
      }
    });

    return { linkedFeatures, legacyFeatures };
  }, [features, environments, experiment.id, experiment.trackingKey]);

  const hasLiveLinkedChanges = includeExperimentInPayload(
    experiment,
    features.filter((f) => experiment.linkedFeatures?.includes(f.id))
  );

  const { data: sdkConnectionsData } = useSDKConnections();
  const connections = sdkConnectionsData?.connections || [];

  const watcherIds = useApi<{
    userIds: string[];
  }>(`/experiment/${experiment.id}/watchers`);
  const { users, organization } = useUser();

  // Get name or email of all active users watching this experiment
  const usersWatching = (watcherIds?.data?.userIds || [])
    .map((id) => users.get(id))
    .filter(Boolean)
    .map((u) => u?.name || u?.email);

  const safeToEdit = experiment.status !== "running" || !hasLiveLinkedChanges;

  return (
    <div>
      {editNameOpen && (
        <EditExperimentNameForm
          experiment={experiment}
          mutate={mutate}
          cancel={() => setEditNameOpen(false)}
        />
      )}
      {auditModal && (
        <Modal
          open={true}
          header="Audit Log"
          close={() => setAuditModal(false)}
          size="lg"
          closeCta="Close"
        >
          <HistoryTable type="experiment" id={experiment.id} />
        </Modal>
      )}
      {watchersModal && (
        <Modal
          open={true}
          header="Experiment Watchers"
          close={() => setWatchersModal(false)}
          closeCta="Close"
        >
          <ul>
            {usersWatching.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </Modal>
      )}
      {visualEditorModal && (
        <VisualChangesetModal
          mode="add"
          experiment={experiment}
          mutate={mutate}
          close={() => setVisualEditorModal(false)}
          onCreate={async (vc) => {
            // Try to immediately open the visual editor
            await openVisualEditor(vc, apiCall);
          }}
          cta="Open Visual Editor"
        />
      )}
      {statusModal && (
        <EditStatusModal
          experiment={experiment}
          close={() => setStatusModal(false)}
          mutate={mutate}
        />
      )}
      {featureModal && (
        <FeatureFromExperimentModal
          features={features}
          experiment={experiment}
          close={() => setFeatureModal(false)}
          onSuccess={async () => {
            await mutateFeatures();
          }}
        />
      )}
      <ExperimentHeader
        experiment={experiment}
        tab={tab}
        setTab={setTabAndScroll}
        mutate={mutate}
        safeToEdit={safeToEdit}
        setAuditModal={setAuditModal}
        setEditNameOpen={setEditNameOpen}
        setStatusModal={setStatusModal}
        setWatchersModal={setWatchersModal}
        duplicate={duplicate}
        usersWatching={usersWatching}
        editResult={editResult || undefined}
        connections={connections}
        linkedFeatures={linkedFeatures}
        visualChangesets={visualChangesets}
        editTargeting={editTargeting}
        newPhase={newPhase}
        editPhases={editPhases}
      />
      <div className="container pagecontents pb-4">
        {experiment.project ===
          getDemoDatasourceProjectIdForOrganization(organization.id) && (
          <div className="alert alert-info mb-3 d-flex align-items-center mt-3">
            <div className="flex-1">
              This experiment is part of our sample dataset. You can safely
              delete this once you are done exploring.
            </div>
            <div style={{ width: 180 }} className="ml-2">
              <DeleteDemoDatasourceButton
                onDelete={() => router.push("/experiments")}
                source="experiment"
              />
            </div>
          </div>
        )}

        {experiment.status === "stopped" && (
          <div className="pt-3">
            <StoppedExperimentBanner
              experiment={experiment}
              linkedFeatures={linkedFeatures}
              mutate={mutate}
              editResult={editResult || undefined}
            />
          </div>
        )}
        {viewingOldPhase && tab === "results" && (
          <div className="alert alert-warning mt-3">
            <div>
              You are viewing the results of a previous experiment phase.{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPhase(experiment.phases.length - 1);
                }}
              >
                Switch to the latest phase
              </a>
            </div>
            <div className="mt-1">
              <strong>Phase settings:</strong>{" "}
              {phaseSummary(experiment?.phases?.[phase])}
            </div>
          </div>
        )}
        <div
          className={clsx(
            "pt-3",
            tab === "overview" ? "d-block" : "d-none d-print-block"
          )}
        >
          <ProjectTagBar
            experiment={experiment}
            editProject={!viewingOldPhase ? editProject : undefined}
            editTags={!viewingOldPhase ? editTags : undefined}
            idea={idea}
          />
          <SetupTabOverview
            experiment={experiment}
            mutate={mutate}
            safeToEdit={safeToEdit}
            editVariations={!viewingOldPhase ? editVariations : undefined}
            disableEditing={viewingOldPhase}
          />
          <Implementation
            experiment={experiment}
            mutate={mutate}
            setFeatureModal={setFeatureModal}
            setVisualEditorModal={setVisualEditorModal}
            visualChangesets={visualChangesets}
            editTargeting={!viewingOldPhase ? editTargeting : undefined}
            linkedFeatures={linkedFeatures}
            legacyFeatures={legacyFeatures}
            mutateFeatures={mutateFeatures}
            connections={connections}
            setTab={setTabAndScroll}
          />
          {experiment.status !== "draft" && (
            <div className="mt-3 mb-2 text-center d-print-none">
              <button
                className="btn btn-lg btn-primary"
                onClick={(e) => {
                  e.preventDefault();
                  setTabAndScroll("results");
                }}
              >
                <FaChartBar /> View Results
              </button>
            </div>
          )}
        </div>
        <div className={tab === "results" ? "d-block" : "d-none d-print-block"}>
          <ResultsTab
            experiment={experiment}
            mutate={mutate}
            editMetrics={editMetrics}
            editPhases={editPhases}
            editResult={editResult}
            newPhase={newPhase}
            connections={connections}
            linkedFeatures={linkedFeatures}
            setTab={setTabAndScroll}
            visualChangesets={visualChangesets}
            editTargeting={editTargeting}
            isTabActive={tab === "results"}
            safeToEdit={safeToEdit}
          />
        </div>
      </div>

      <div
        className="bg-white mt-4 px-4 border-top"
        style={{ marginLeft: -8, marginRight: -8 }}
      >
        <div className="pt-2 pt-4 pb-5 container pagecontents">
          <div className="h3 mb-4">Comments</div>
          <DiscussionThread
            type="experiment"
            id={experiment.id}
            allowNewComments={!experiment.archived}
            project={experiment.project}
          />
        </div>
      </div>
    </div>
  );
}
